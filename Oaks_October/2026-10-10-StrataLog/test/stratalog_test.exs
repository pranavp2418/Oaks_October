defmodule StrataLogTest do
  use ExUnit.Case
  defp e(id, seq, value \\ "v"), do: {id, "s", seq, "put", "k", value}
  defp store do
    dir = Path.join(System.tmp_dir!(), "strata-test-#{System.unique_integer([:positive])}")
    File.mkdir_p!(dir); on_exit(fn -> File.rm_rf!(dir) end)
    {:ok, p} = StrataLog.start_link(dir); {dir, p}
  end
  test "atomic batch, exact retries and restart" do
    {dir,p} = store()
    assert {:ok,%{applied: 2,revision: 1}} = StrataLog.ingest(p,[e("a",1),e("b",2,"v2")])
    assert {:ok,%{applied: 0,duplicates: 2,revision: 1}} = StrataLog.ingest(p,[e("a",1),e("b",2,"v2")])
    GenServer.stop(p); {:ok,q} = StrataLog.start_link(dir)
    assert StrataLog.view(q).rows == %{{"s","k"} => "v2"}
  end
  test "invalid later offset leaves entire frame unapplied" do
    {_,p} = store(); assert {:error,_} = StrataLog.ingest(p,[e("a",1),e("b",3)])
    assert StrataLog.view(p).revision == 0; assert StrataLog.view(p).rows == %{}
  end
  test "conflicting retry and schema errors preserve revision" do
    {_,p} = store(); StrataLog.ingest(p,[e("a",1)])
    assert {:error,_} = StrataLog.ingest(p,[e("a",1,"changed")])
    assert {:error,_} = StrataLog.ingest(p,[{"b","s",2,"put","k","a\tb"}])
    assert StrataLog.view(p).revision == 1
  end
  test "tombstone and snapshot preserve all dedup fences" do
    {dir,p} = store(); StrataLog.ingest(p,[e("a",1),{"b","s",2,"delete","k",nil}])
    assert :ok = StrataLog.checkpoint(p); GenServer.stop(p); {:ok,q} = StrataLog.start_link(dir)
    assert StrataLog.view(q).rows == %{}
    assert {:ok,%{applied: 0,duplicates: 1}} = StrataLog.ingest(q,[e("a",1)])
    assert {:error,_} = StrataLog.ingest(q,[e("a",1,"other")])
  end
  test "every torn-frame prefix discards whole last batch" do
    base = StrataLog.frame({:batch,1,[e("a",1)]});tail = StrataLog.frame({:batch,2,[e("b",2,"v2")]})
    Enum.each(1..(byte_size(tail)-1),fn n ->
      {s,used,torn} = StrataLog.scan(base <> binary_part(tail,0,n))
      assert s.revision == 1; assert used == byte_size(base); assert torn == n
    end)
  end
  test "complete checksum corruption fails closed" do
    frame = StrataLog.frame({:batch,1,[e("a",1)]});<<head::binary-size(12),byte,tail::binary>> = frame
    assert_raise ArgumentError,~r/checksum/,fn -> StrataLog.scan(head <> <<Bitwise.bxor(byte,1)>> <> tail) end
  end
  test "actor serialization admits exactly one concurrent identical event" do
    {_,p} = store()
    results = 1..40 |> Task.async_stream(fn _ -> StrataLog.ingest(p,[e("a",1)]) end,max_concurrency: 10) |> Enum.map(fn {:ok,{:ok,v}} -> v.applied end)
    assert Enum.sum(results) == 1; assert StrataLog.view(p).revision == 1
  end
  test "recovery truncates tail before appending next batch" do
    {dir,p} = store();StrataLog.ingest(p,[e("a",1)]);GenServer.stop(p)
    File.write!(Path.join(dir,"changes.wal"),<<"SLG1",100::32,0::32,"short">>,[:append])
    {:ok,q} = StrataLog.start_link(dir); assert StrataLog.view(q).recovered_tail_bytes == 17
    assert {:ok,_} = StrataLog.ingest(q,[e("b",2,"v2")]);GenServer.stop(q)
    {:ok,r} = StrataLog.start_link(dir);assert StrataLog.view(r).revision == 2
  end
  test "independent map oracle across 400 seeded changes and restarts" do
    :rand.seed(:exsss,{10,10,2026});{dir,p} = store()
    oracle = Enum.reduce(1..400,%{},fn i,expected ->
      key = "k#{:rand.uniform(15)}";value = "v#{i}";op = if rem(i,5)==0,do: "delete",else: "put"
      event = {"id#{i}","s",i,op,key,if(op=="delete",do: nil,else: value)}
      assert {:ok,_} = StrataLog.ingest(p,[event])
      expected = if op=="delete",do: Map.delete(expected,{"s",key}),else: Map.put(expected,{"s",key},value)
      if rem(i,73)==0,do: assert(:ok == StrataLog.checkpoint(p))
      assert StrataLog.view(p).rows == expected;expected
    end)
    GenServer.stop(p);{:ok,q} = StrataLog.start_link(dir);assert StrataLog.view(q).rows == oracle
  end
  test "parser complete schema and bad numeric data" do
    assert length(StrataLog.parse_tsv("# sample\na\ts\t1\tput\tk\tv\n")) == 1
    assert_raise MatchError,fn -> StrataLog.parse_tsv("a\ts\tno\tput\tk\tv") end
    assert_raise ArgumentError,fn -> StrataLog.parse_tsv("a\ts\t1\tbad\tk\tv") end
  end
end
