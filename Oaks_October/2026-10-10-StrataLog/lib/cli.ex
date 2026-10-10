defmodule StrataLog.CLI do
  def main(args) do
    Process.flag(:trap_exit, true)
    try do
      case args do
        [cmd, dir | rest] when cmd in ["ingest", "inspect", "export", "get", "checkpoint", "verify"] ->
          case StrataLog.start_link(dir) do
            {:ok, p} -> run(cmd, p, rest)
            {:error, e} -> raise ArgumentError, inspect(e)
          end
        _ -> raise ArgumentError, "Usage: stratalog ingest|inspect|export|get|checkpoint|verify STORE [TSV|OUTPUT|STREAM KEY]"
      end
    rescue e -> IO.puts(:stderr, "StrataLog: #{Exception.message(e)}"); System.halt(2)
    catch :exit, reason -> IO.puts(:stderr, "StrataLog: store stopped #{inspect(reason)}; reopen to recover"); System.halt(2) end
  end
  defp run("ingest", p, [input]) do
    case StrataLog.ingest(p, StrataLog.parse_tsv(File.read!(input))) do
      {:ok, result} -> IO.puts("committed revision=#{result.revision} applied=#{result.applied} duplicates=#{result.duplicates}")
      {:error, e} -> raise ArgumentError, e
    end
  end
  defp run("inspect", p, []) do
    s = StrataLog.view(p)
    IO.puts("StrataLog / durable change store\nrevision #{s.revision}\nrows #{map_size(s.rows)}\nretained event ids #{map_size(s.seen)}\nrecovered tail bytes #{s.recovered_tail_bytes}")
    Enum.sort(s.offsets) |> Enum.each(fn {k,v} -> IO.puts("stream #{k}: offset #{v}") end)
  end
  defp run("verify", p, []), do: run("inspect", p, [])
  defp run("get", p, [stream, key]), do: IO.puts(Map.get(StrataLog.view(p).rows, {stream, key}, "<absent>"))
  defp run("export", p, [output]) do
    text = StrataLog.view(p).rows |> Enum.sort() |> Enum.map_join("", fn {{stream,key},v} -> "#{stream}\t#{key}\t#{v}\n" end)
    if Path.basename(output) in ["changes.wal", ".writer-lock"], do: raise(ArgumentError, "reserved output name")
    File.write!(output <> ".pending", text); File.rename!(output <> ".pending", output)
    IO.puts("exported #{byte_size(text)} bytes sha256=#{Base.encode16(:crypto.hash(:sha256,text),case: :lower)}")
  end
  defp run("checkpoint", p, []) do
    case StrataLog.checkpoint(p) do
      :ok -> IO.puts("checkpoint atomically replaced WAL; event ids retained")
      {:error,e} -> raise ArgumentError, e
    end
  end
  defp run(_, _, _), do: raise(ArgumentError, "invalid command arguments")
end
