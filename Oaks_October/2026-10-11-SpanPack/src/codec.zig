const std = @import("std");
const max_samples = 4096;
var input: [max_samples]i32 = undefined;
var archive: [65536]u8 = undefined;
var output: [max_samples]i32 = undefined;
var staging: [max_samples]i32 = undefined;
var damage: [256]u8 = undefined;
var metadata: [4096]u8 = undefined;
var scratch: [2048]u8 = undefined;
var total: u32 = 0;
var blocks: u32 = 0;
fn put(b: []u8, at: usize, n: u32) void { for (0..4) |j| b[at+j] = @truncate(n >> @as(u5,@intCast(j*8))); }
fn get(b: []const u8, at: usize) u32 { var n:u32=0;for(0..4)|j| n |= @as(u32,b[at+j]) << @as(u5,@intCast(j*8));return n; }
fn variable(b: []u8, at: *usize, x:u64) void {var n=x;while(n>=128){b[at.*]=@as(u8,@truncate(n))|128;at.*+=1;n>>=7;}b[at.*]=@intCast(n);at.*+=1;}
fn readvar(b: []const u8, at: *usize) ?u64 { var n:u64=0;var shift:u6=0;for(0..5)|_|{if(at.*>=b.len)return null;const v=b[at.*];at.*+=1;n|=@as(u64,v&127)<<shift;if(v&128==0){if(shift>0 and v==0)return null;return n;}shift+=7;}return null; }
fn crc(b: []const u8) u32 {return std.hash.Crc32.hash(b);}
export fn input_ptr() usize{return @intFromPtr(&input);}
export fn archive_ptr() usize{return @intFromPtr(&archive);}
export fn output_ptr() usize{return @intFromPtr(&output);}
export fn damage_ptr() usize{return @intFromPtr(&damage);}
export fn sample_count() u32{return total;}
export fn block_count() u32{return blocks;}
export fn encode(n:u32,size:u32) i32 {
 if(n==0 or n>max_samples or size<16 or size>256)return -1;
 const bc=(n+size-1)/size;const header=16+bc*12;var at:usize=header;
 @memcpy(archive[0..4],"SPK1");put(&archive,4,n);archive[8]=@truncate(size);archive[9]=@truncate(size>>8);archive[10]=@truncate(bc);archive[11]=@truncate(bc>>8);put(&archive,12,0);
 for(0..bc)|bi|{
  const start=bi*size;const count=@min(size,n-start);var pos:usize=8;scratch[0]=@truncate(count);scratch[1]=@truncate(count>>8);scratch[2]=1;scratch[3]=0;put(&scratch,4,@bitCast(input[start]));var j:usize=1;
  while(j<count){const d=@as(i64,input[start+j])-@as(i64,input[start+j-1]);if(d==0){var run:usize=1;while(j+run<count and input[start+j+run]==input[start+j])run+=1;scratch[pos]=0;pos+=1;variable(&scratch,&pos,run);j+=@intCast(run);}else{scratch[pos]=1;pos+=1;const z:u64=if(d>=0)@intCast(d*2) else @intCast(-d*2-1);variable(&scratch,&pos,z);j+=1;}}
  const rawlen=4+count*4;var len:usize=pos;
  if(rawlen<=pos){len=rawlen;scratch[2]=0;for(0..count)|k|put(&scratch,4+k*4,@bitCast(input[start+k]));}
  put(&archive,16+bi*12,@intCast(at));put(&archive,20+bi*12,@intCast(len));put(&archive,24+bi*12,crc(scratch[0..len]));@memcpy(archive[at..at+len],scratch[0..len]);at+=len;
 }
 put(&archive,12,crc(archive[0..header]));total=n;blocks=bc;return @intCast(at);
}
fn inspect(len:u32) ?u32 {
 if(len<28 or len>archive.len or !std.mem.eql(u8,archive[0..4],"SPK1"))return null;
 const n=get(&archive,4);const size=@as(u32,archive[8])|(@as(u32,archive[9])<<8);const bc=@as(u32,archive[10])|(@as(u32,archive[11])<<8);
 if(n==0 or n>max_samples or size<16 or size>256 or bc!=(n+size-1)/size)return null;
 const h=16+bc*12;if(h>len)return null;@memcpy(metadata[0..h],archive[0..h]);put(&metadata,12,0);if(crc(metadata[0..h])!=get(&archive,12))return null;
 var expected:u32=h;for(0..bc)|bi|{const off=get(&archive,16+bi*12);const blen=get(&archive,20+bi*12);if(off!=expected or blen<8 or blen>2048 or off>len or blen>len-off)return null;expected=off+blen;}if(expected!=len)return null;
 total=n;blocks=bc;return size;
}
fn decodeblock(bi:usize,size:u32) bool {
 const off=get(&archive,16+bi*12);const len=get(&archive,20+bi*12);const b=archive[off..off+len];if(crc(b)!=get(&archive,24+bi*12))return false;
 const count=@as(u32,b[0])|(@as(u32,b[1])<<8);const start=bi*size;if(count!=@min(size,total-start) or b[3]!=0)return false;
 if(b[2]==0){if(len!=4+count*4)return false;for(0..count)|j|staging[start+j]=@bitCast(get(b,4+j*4));return true;}
 if(b[2]!=1 or len<8)return false;staging[start]=@bitCast(get(b,4));var at:usize=8;var j:usize=1;
 while(j<count){if(at>=b.len)return false;const tag=b[at];at+=1;const value=readvar(b,&at) orelse return false;
  if(tag==0){if(value==0 or value>count-j)return false;for(0..@as(usize,@intCast(value)))|_|{staging[start+j]=staging[start+j-1];j+=1;}}
  else if(tag==1){if(value==0 or value>8589934590)return false;const delta:i64=if(value&1==0)@intCast(value/2) else -@as(i64,@intCast((value+1)/2));const next=@as(i64,staging[start+j-1])+delta;if(next<std.math.minInt(i32) or next>std.math.maxInt(i32))return false;staging[start+j]=@intCast(next);j+=1;}
  else return false;
 }
 return at==b.len;
}
export fn decode(len:u32,salvage:u32) i32 {
 const size=inspect(len) orelse return -2;var bad:u32=0;
 for(0..blocks)|bi|{const ok=decodeblock(bi,size);damage[bi]=if(ok)0 else 1;if(!ok){bad+=1;const start=bi*size;@memset(staging[start..@min(total,start+size)],0);}}
 if(bad>0 and salvage==0)return -3;@memcpy(output[0..total],staging[0..total]);return @intCast(bad);
}
export fn seek(len:u32,index:u32) i32 {const size=inspect(len) orelse return -2;if(index>=total)return -1;const bi=index/size;if(!decodeblock(bi,size))return -3;output[index]=staging[index];return 0;}
test "round trip extremes and corruption" {input[0]=std.math.minInt(i32);input[1]=std.math.maxInt(i32);for(2..128)|i|input[i]=@intCast(i/8);const len=encode(128,32);try std.testing.expect(len>0);try std.testing.expectEqual(@as(i32,0),decode(@intCast(len),0));try std.testing.expectEqualSlices(i32,input[0..128],output[0..128]);archive[@as(usize,@intCast(len))-1]^=1;try std.testing.expectEqual(@as(i32,-3),decode(@intCast(len),0));try std.testing.expectEqual(@as(i32,1),decode(@intCast(len),1));}
test "seek and invalid input" {for(0..100)|i|input[i]=@intCast(i*3);const len=encode(100,16);try std.testing.expectEqual(@as(i32,0),seek(@intCast(len),73));try std.testing.expectEqual(input[73],output[73]);try std.testing.expectEqual(@as(i32,-1),seek(@intCast(len),100));try std.testing.expectEqual(@as(i32,-1),encode(4097,32));archive[5]^=1;try std.testing.expectEqual(@as(i32,-2),decode(@intCast(len),1));}
