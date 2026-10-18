use std::io::{self,Read};
fn main(){let mut bytes=Vec::new();io::stdin().take(65537).read_to_end(&mut bytes).expect("stdin");if bytes.len()>65536{println!("{{\"ok\":false,\"error\":\"Request too large\"}}");return}let source=String::from_utf8(bytes).unwrap_or_default();println!("{}",fallow_core::solve_json(&source));}
