defmodule StrataLog do
  @moduledoc "Actor-serialized change store with atomic batch frames and fail-closed recovery."
  use GenServer
  @max_frame 4_000_000
  def start_link(dir), do: GenServer.start_link(__MODULE__, Path.expand(dir), name: {:global, {__MODULE__, Path.expand(dir)}})
  def ingest(pid, events), do: GenServer.call(pid, {:ingest, events}, 30_000)
  def view(pid), do: GenServer.call(pid, :view)
  def checkpoint(pid), do: GenServer.call(pid, :checkpoint)
  def empty, do: %{rows: %{}, offsets: %{}, seen: %{}, revision: 0}
  def frame(term) do
    b = :erlang.term_to_binary(term)
    if byte_size(b) > @max_frame, do: raise(ArgumentError, "batch frame exceeds 4MB")
    <<"SLG1", byte_size(b)::unsigned-big-32, :erlang.crc32(b)::unsigned-big-32, b::binary>>
  end
  def parse_tsv(text) do
    text |> String.split("\n", trim: true) |> Enum.reject(&String.starts_with?(&1, "#")) |> Enum.map(fn line ->
      case String.split(String.trim_trailing(line, "\r"), "\t") do
        [id, stream, seq, op, key, value] ->
          {offset, ""} = Integer.parse(seq)
          event = {id, stream, offset, op, key, if(op == "delete", do: nil, else: value)}
          validate(event); event
        _ -> raise ArgumentError, "TSV needs id, stream, offset, put/delete, key, value"
      end
    end)
  end
  defp token(v), do: is_binary(v) and byte_size(v) in 1..200 and not String.contains?(v, ["\t", "\n", "\r", <<0>>])
  defp validate({id, stream, offset, op, key, value}) do
    unless token(id) and token(stream) and token(key) and is_integer(offset) and offset > 0 and op in ["put", "delete"] and
      ((op == "delete" and value == nil) or (op == "put" and is_binary(value) and byte_size(value) <= 10_000 and not String.contains?(value, ["\t", "\n", "\r", <<0>>]))),
      do: raise(ArgumentError, "invalid event schema")
  end
  defp validate(_), do: raise(ArgumentError, "invalid event tuple")
  def apply_events(state, events) when is_list(events) and length(events) in 1..1000 do
    Enum.reduce(events, {state, [], 0}, fn event, {s, applied, duplicates} ->
      validate(event)
      {id, stream, offset, op, key, value} = event
      signature = :crypto.hash(:sha256, :erlang.term_to_binary(event))
      case Map.get(s.seen, id) do
        ^signature -> {s, applied, duplicates + 1}
        nil ->
          unless offset == Map.get(s.offsets, stream, 0) + 1, do: raise(ArgumentError, "offset gap/stale event in #{stream}")
          if map_size(s.seen) >= 100_000, do: raise(ArgumentError, "100000-event retained dedup limit")
          rows = if op == "put", do: Map.put(s.rows, {stream, key}, value), else: Map.delete(s.rows, {stream, key})
          {%{s | rows: rows, offsets: Map.put(s.offsets, stream, offset), seen: Map.put(s.seen, id, signature)}, applied ++ [event], duplicates}
        _ -> raise ArgumentError, "operation id conflict: #{id}"
      end
    end)
  end
  def apply_events(_, _), do: raise(ArgumentError, "batch must contain 1..1000 events")
  def scan(bytes), do: scan(bytes, empty(), 0)
  defp scan(<<>>, state, used), do: {state, used, 0}
  defp scan(bytes, state, used) when byte_size(bytes) < 12, do: {state, used, byte_size(bytes)}
  defp scan(<<"SLG1", size::unsigned-big-32, crc::unsigned-big-32, rest::binary>>, state, used) do
    if size > @max_frame or size == 0, do: raise(ArgumentError, "invalid frame length")
    if byte_size(rest) < size do
      {state, used, 12 + byte_size(rest)}
    else
      <<payload::binary-size(size), tail::binary>> = rest
      if :erlang.crc32(payload) != crc, do: raise(ArgumentError, "checksum corruption at byte #{used}")
      term = :erlang.binary_to_term(payload, [:safe])
      next = case term do
        {:batch, revision, events} ->
          if revision != state.revision + 1, do: raise(ArgumentError, "invalid revision")
          {s, applied, dup} = apply_events(state, events)
          if dup != 0 or length(applied) != length(events), do: raise(ArgumentError, "duplicate persisted batch")
          %{s | revision: revision}
        {:snapshot, %{rows: rows, offsets: offsets, seen: seen, revision: revision} = s} when used == 0 ->
          unless is_map(rows) and is_map(offsets) and is_map(seen) and is_integer(revision) and revision >= 0, do: raise(ArgumentError, "invalid snapshot")
          s
        _ -> raise ArgumentError, "invalid record"
      end
      scan(tail, next, used + 12 + size)
    end
  end
  defp scan(_, _, used), do: raise(ArgumentError, "frame magic corruption at byte #{used}")
  def init(dir) do
    try do
      File.mkdir_p!(dir)
      path = Path.join(dir, "changes.wal")
      bytes = if File.exists?(path), do: File.read!(path), else: <<>>
      {state, used, torn} = scan(bytes)
      {:ok, io} = :file.open(String.to_charlist(path), [:read, :write, :binary, :raw])
      {:ok, _} = :file.position(io, used)
      :ok = :file.truncate(io)
      :ok = :file.sync(io)
      {:ok, %{state: state, io: io, path: path, torn: torn}}
    rescue e -> {:stop, Exception.message(e)} end
  end
  def handle_call(:view, _, s), do: {:reply, Map.put(s.state, :recovered_tail_bytes, s.torn), s}
  def handle_call({:ingest, events}, _, s) do
    checked = try do
      {:ok, apply_events(s.state, events)}
    rescue e -> {:error, Exception.message(e)} end
    case checked do
      {:error, e} -> {:reply, {:error, e}, s}
      {:ok, {next, applied, dup}} ->
      if applied == [] do
        {:reply, {:ok, %{applied: 0, duplicates: dup, revision: s.state.revision}}, s}
      else
        next = %{next | revision: s.state.revision + 1}
        record = frame({:batch, next.revision, applied})
        case with :ok <- :file.write(s.io, record), :ok <- :file.sync(s.io), do: :ok do
          :ok ->
            if System.get_env("STRATALOG_FAULT") == "after_sync", do: System.halt(86)
            {:reply, {:ok, %{applied: length(applied), duplicates: dup, revision: next.revision}}, %{s | state: next}}
          error -> {:stop, {:storage_failed, error}, {:error, "storage failed; reopen to recover"}, s}
        end
      end
    end
  end
  def handle_call(:checkpoint, _, s) do
    tmp = s.path <> ".pending"
    try do
      {:ok, f} = :file.open(String.to_charlist(tmp), [:write, :binary, :raw])
      :ok = :file.write(f, frame({:snapshot, s.state})); :ok = :file.sync(f); :ok = :file.close(f)
      :ok = File.rename(tmp, s.path)
      :ok = :file.close(s.io)
      {:ok, io} = :file.open(String.to_charlist(s.path), [:read, :write, :binary, :raw])
      {:ok, _} = :file.position(io, :eof)
      {:reply, :ok, %{s | io: io}}
    rescue e -> {:stop, {:checkpoint_failed, Exception.message(e)}, {:error, "checkpoint failed; reopen to recover"}, s} end
  end
  def terminate(_, s), do: :file.close(s.io)
end
