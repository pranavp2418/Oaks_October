use std::hint::black_box;
use std::time::Instant;
use tidemark::{decode_records, encode_records, Event, Record};
fn fixed(records: &[Record]) -> Vec<u8> {
    let mut out = Vec::with_capacity(records.len() * 15);
    for r in records {
        out.extend(r.event.id.to_le_bytes());
        out.extend(r.event.sensor.to_le_bytes());
        out.extend(r.event.time.to_le_bytes());
        out.extend(r.event.value.to_le_bytes());
        out.push(u8::from(r.accepted));
    }
    out
}
fn main() {
    let mut seed = 81026u32;
    let records: Vec<_> = (1..=5000)
        .map(|i| {
            seed = seed.wrapping_mul(1664525).wrapping_add(1013904223);
            Record {
                event: Event {
                    id: i,
                    sensor: (i % 3 + 1) as u16,
                    time: i * 5,
                    value: 5000 + (seed % 21) as i32 - 10,
                },
                accepted: true,
            }
        })
        .collect();
    let encoded = encode_records(&records);
    assert_eq!(decode_records(&encoded).unwrap(), records);
    let base = fixed(&records);
    for _ in 0..10 {
        black_box(encode_records(black_box(&records)));
        black_box(fixed(black_box(&records)));
    }
    let mut codec = vec![];
    let mut baseline = vec![];
    for _ in 0..100 {
        let t = Instant::now();
        black_box(encode_records(black_box(&records)));
        codec.push(t.elapsed().as_nanos() as u64);
        let t = Instant::now();
        black_box(fixed(black_box(&records)));
        baseline.push(t.elapsed().as_nanos() as u64);
    }
    codec.sort();
    baseline.sort();
    println!(
        "{}",
        serde_json::json!({"seed":81026,"records":5000,"warmup":10,"repetitions":100,"method":"single-thread release encode wall-clock; allocation included; black_box prevents elision","codec_bytes":encoded.len(),"fixed_bytes":base.len(),"codec_encode_ns":{"p50":codec[50],"p95":codec[95]},"fixed_encode_ns":{"p50":baseline[50],"p95":baseline[95]},"correctness":"100% record equality after codec decode"})
    );
}
