use serde::{Deserialize, Serialize};
use std::cell::RefCell;
use std::collections::BTreeMap;
#[derive(Clone, Serialize, Deserialize, Debug, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct Config {
    pub width: u32,
    pub lag: u32,
    pub threshold: i32,
}
impl Config {
    fn validate(&self) -> Result<(), String> {
        if !(1..=3600).contains(&self.width)
            || self.lag > 3600
            || !(-1000000..=1000000).contains(&self.threshold)
        {
            Err("Invalid window configuration".into())
        } else {
            Ok(())
        }
    }
}
#[derive(Clone, Serialize, Deserialize, Debug, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct Event {
    pub id: u32,
    pub sensor: u16,
    pub time: u32,
    pub value: i32,
}
impl Event {
    fn validate(&self) -> Result<(), String> {
        if self.id == 0
            || self.sensor == 0
            || self.sensor > 100
            || self.time > 1000000000
            || !(-1000000..=1000000).contains(&self.value)
        {
            Err("Event outside bounded schema".into())
        } else {
            Ok(())
        }
    }
}
#[derive(Clone, Serialize, Deserialize, Debug, PartialEq)]
pub struct Record {
    pub event: Event,
    pub accepted: bool,
}
#[derive(Clone, Serialize, Deserialize, Debug, PartialEq)]
pub struct State {
    pub config: Config,
    pub watermark: u32,
    pub max_time: u32,
    pub revision: u32,
    pub duplicates: u32,
    pub acknowledgements: BTreeMap<String, String>,
    pub operations: BTreeMap<String, String>,
    pub audit: Vec<String>,
    #[serde(skip)]
    pub records: Vec<Record>,
}
#[derive(Clone, Serialize, Deserialize, Debug)]
#[serde(tag = "type", rename_all = "snake_case", deny_unknown_fields)]
pub enum Action {
    Ingest { event: Event },
    Advance { time: u32 },
    Acknowledge { window: String, note: String },
}
#[derive(Clone, Serialize, Deserialize, Debug)]
pub struct Command {
    pub id: String,
    pub revision: u32,
    #[serde(flatten)]
    pub action: Action,
}
#[derive(Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Request {
    pub config: Config,
    #[serde(default)]
    pub checkpoint: Option<Vec<u8>>,
    pub commands: Vec<Command>,
}
#[derive(Serialize, Deserialize, Debug, PartialEq)]
pub struct Window {
    pub key: String,
    pub sensor: u16,
    pub start: u32,
    pub end: u32,
    pub count: u32,
    pub sum: i64,
    pub min: i32,
    pub max: i32,
    pub closed: bool,
    pub alert: bool,
    pub acknowledged: bool,
}
pub fn windows(s: &State) -> Vec<Window> {
    let mut map: BTreeMap<(u16, u32), Window> = BTreeMap::new();
    for r in s.records.iter().filter(|r| r.accepted) {
        let e = &r.event;
        let start = e.time / s.config.width * s.config.width;
        let w = map.entry((e.sensor, start)).or_insert(Window {
            key: format!("{}:{}", e.sensor, start),
            sensor: e.sensor,
            start,
            end: start + s.config.width,
            count: 0,
            sum: 0,
            min: e.value,
            max: e.value,
            closed: false,
            alert: false,
            acknowledged: false,
        });
        w.count += 1;
        w.sum += e.value as i64;
        w.min = w.min.min(e.value);
        w.max = w.max.max(e.value);
    }
    for w in map.values_mut() {
        w.closed = w.end <= s.watermark;
        w.alert = w.closed && w.max >= s.config.threshold;
        w.acknowledged = s.acknowledgements.contains_key(&w.key);
    }
    map.into_values().collect()
}
pub fn new_state(config: Config) -> Result<State, String> {
    config.validate()?;
    Ok(State {
        config,
        watermark: 0,
        max_time: 0,
        revision: 0,
        duplicates: 0,
        acknowledgements: BTreeMap::new(),
        operations: BTreeMap::new(),
        audit: vec![],
        records: vec![],
    })
}
pub fn apply(s: &mut State, c: &Command) -> Result<(), String> {
    if c.id.is_empty() || c.id.len() > 80 {
        return Err("Invalid operation ID".into());
    }
    let serial = serde_json::to_string(c).map_err(|e| e.to_string())?;
    if let Some(old) = s.operations.get(&c.id) {
        return if *old == serial {
            Ok(())
        } else {
            Err("Operation idempotency conflict".into())
        };
    }
    if c.revision != s.revision {
        return Err("Revision conflict".into());
    }
    if s.operations.len() >= 500 {
        return Err("Operation budget reached".into());
    }
    match &c.action {
        Action::Ingest { event: e } => {
            e.validate()?;
            if let Some(old) = s.records.iter().find(|r| r.event.id == e.id) {
                if old.event != *e {
                    return Err("Event identity conflict".into());
                }
                s.duplicates += 1;
            } else {
                if s.records.len() >= 10000 {
                    return Err("Record budget reached".into());
                }
                let accepted = e.time >= s.watermark;
                s.records.push(Record {
                    event: e.clone(),
                    accepted,
                });
                if accepted {
                    s.max_time = s.max_time.max(e.time);
                    s.watermark = s.watermark.max(s.max_time.saturating_sub(s.config.lag));
                }
            }
        }
        Action::Advance { time } => {
            if *time < s.watermark || *time > 1000000000 {
                return Err("Watermark must increase within bound".into());
            }
            s.watermark = *time;
        }
        Action::Acknowledge { window, note } => {
            if note.trim().len() < 4 || note.len() > 300 {
                return Err("Meaningful review note required".into());
            }
            let w = windows(s)
                .into_iter()
                .find(|w| w.key == *window)
                .ok_or("Window not found")?;
            if !w.alert {
                return Err("Only a finalized alert can be acknowledged".into());
            }
            s.acknowledgements.insert(window.clone(), note.clone());
        }
    }
    s.revision += 1;
    s.audit.push(format!("r{} {}", s.revision, c.id));
    s.operations.insert(c.id.clone(), serial);
    Ok(())
}
fn zig(v: i64) -> u64 {
    ((v << 1) ^ (v >> 63)) as u64
}
fn unzig(v: u64) -> i64 {
    ((v >> 1) as i64) ^ (-((v & 1) as i64))
}
fn put(mut x: u64, out: &mut Vec<u8>) {
    while x >= 128 {
        out.push((x as u8) | 128);
        x >>= 7;
    }
    out.push(x as u8)
}
fn get(bytes: &[u8], pos: &mut usize) -> Result<u64, String> {
    let mut value = 0u64;
    for shift in (0..70).step_by(7) {
        let b = *bytes.get(*pos).ok_or("Truncated varint")?;
        *pos += 1;
        if shift == 63 && b > 1 {
            return Err("Varint overflow".into());
        }
        value |= ((b & 127) as u64) << shift;
        if b < 128 {
            return Ok(value);
        }
    }
    Err("Varint too long".into())
}
pub fn crc32(bytes: &[u8]) -> u32 {
    let mut crc = !0u32;
    for b in bytes {
        crc ^= *b as u32;
        for _ in 0..8 {
            crc = (crc >> 1) ^ if crc & 1 != 0 { 0xedb88320 } else { 0 };
        }
    }
    !crc
}
pub fn encode_records(records: &[Record]) -> Vec<u8> {
    let mut out = vec![];
    put(records.len() as u64, &mut out);
    let (mut last_t, mut last_dt, mut last_v, mut last_id) = (0i64, 0i64, 0i64, 0i64);
    for r in records {
        let e = &r.event;
        put(zig(e.id as i64 - last_id), &mut out);
        put(e.sensor as u64, &mut out);
        let dt = e.time as i64 - last_t;
        put(zig(dt - last_dt), &mut out);
        put(zig(e.value as i64 - last_v), &mut out);
        out.push(u8::from(r.accepted));
        last_t = e.time as i64;
        last_dt = dt;
        last_v = e.value as i64;
        last_id = e.id as i64;
    }
    out
}
pub fn decode_records(bytes: &[u8]) -> Result<Vec<Record>, String> {
    let mut p = 0;
    let count = get(bytes, &mut p)?;
    if count > 10000 {
        return Err("Record count exceeds bound".into());
    }
    let mut out = vec![];
    let (mut t, mut dt, mut v, mut id) = (0i64, 0i64, 0i64, 0i64);
    for _ in 0..count {
        id = id
            .checked_add(unzig(get(bytes, &mut p)?))
            .ok_or("ID overflow")?;
        let sensor = get(bytes, &mut p)?;
        dt = dt
            .checked_add(unzig(get(bytes, &mut p)?))
            .ok_or("Delta overflow")?;
        t = t.checked_add(dt).ok_or("Timestamp overflow")?;
        v = v
            .checked_add(unzig(get(bytes, &mut p)?))
            .ok_or("Value overflow")?;
        let flag = *bytes.get(p).ok_or("Missing acceptance flag")?;
        p += 1;
        if id <= 0
            || id > u32::MAX as i64
            || sensor > u16::MAX as u64
            || t < 0
            || t > 1000000000
            || !(-1000000..=1000000).contains(&v)
            || flag > 1
        {
            return Err("Invalid encoded event".into());
        }
        let e = Event {
            id: id as u32,
            sensor: sensor as u16,
            time: t as u32,
            value: v as i32,
        };
        e.validate()?;
        out.push(Record {
            event: e,
            accepted: flag == 1,
        });
    }
    if p != bytes.len() {
        return Err("Trailing record bytes".into());
    }
    Ok(out)
}
pub fn checkpoint(s: &State) -> Result<Vec<u8>, String> {
    let meta = serde_json::to_vec(s).map_err(|e| e.to_string())?;
    let mut out = b"TMK1".to_vec();
    out.extend((meta.len() as u32).to_le_bytes());
    out.extend(meta);
    out.extend(encode_records(&s.records));
    let crc = crc32(&out);
    out.extend(crc.to_le_bytes());
    Ok(out)
}
pub fn restore(bytes: &[u8]) -> Result<State, String> {
    if bytes.len() < 13 || bytes.len() > 1500000 || &bytes[..4] != b"TMK1" {
        return Err("Invalid checkpoint header".into());
    }
    let end = bytes.len() - 4;
    let crc = u32::from_le_bytes(bytes[end..].try_into().unwrap());
    if crc32(&bytes[..end]) != crc {
        return Err("Checkpoint checksum mismatch".into());
    }
    let len = u32::from_le_bytes(bytes[4..8].try_into().unwrap()) as usize;
    if len > end - 8 {
        return Err("Truncated checkpoint metadata".into());
    }
    let mut s: State = serde_json::from_slice(&bytes[8..8 + len]).map_err(|e| e.to_string())?;
    s.config.validate()?;
    s.records = decode_records(&bytes[8 + len..end])?;
    let mut seen = BTreeMap::new();
    for r in &s.records {
        if seen.insert(r.event.id, ()).is_some() {
            return Err("Duplicate checkpoint record ID".into());
        }
    }
    if s.watermark > 1000000000
        || s.max_time > 1000000000
        || s.operations.len() > 500
        || s.revision as usize != s.operations.len()
        || s.audit.len() != s.operations.len()
    {
        return Err("Checkpoint metadata invariant failed".into());
    }
    if s.max_time
        != s.records
            .iter()
            .filter(|r| r.accepted)
            .map(|r| r.event.time)
            .max()
            .unwrap_or(0)
        || s.watermark < s.max_time.saturating_sub(s.config.lag)
    {
        return Err("Checkpoint watermark invariant failed".into());
    }
    Ok(s)
}
#[derive(Serialize)]
pub struct Response {
    pub config: Config,
    pub revision: u32,
    pub watermark: u32,
    pub max_time: u32,
    pub accepted: usize,
    pub late: usize,
    pub duplicates: u32,
    pub windows: Vec<Window>,
    pub records: Vec<Record>,
    pub audit: Vec<String>,
    pub checkpoint: Vec<u8>,
    pub codec_bytes: usize,
    pub raw_record_bytes: usize,
}
pub fn process(req: Request) -> Result<Response, String> {
    req.config.validate()?;
    if req.commands.len() > 500 {
        return Err("Command budget exceeded".into());
    }
    let mut s = if let Some(bytes) = req.checkpoint {
        let s = restore(&bytes)?;
        if s.config != req.config {
            return Err("Checkpoint configuration mismatch".into());
        }
        s
    } else {
        new_state(req.config.clone())?
    };
    for c in req.commands {
        apply(&mut s, &c)?
    }
    let bytes = checkpoint(&s)?;
    let encoded = encode_records(&s.records);
    Ok(Response {
        config: s.config.clone(),
        revision: s.revision,
        watermark: s.watermark,
        max_time: s.max_time,
        accepted: s.records.iter().filter(|r| r.accepted).count(),
        late: s.records.iter().filter(|r| !r.accepted).count(),
        duplicates: s.duplicates,
        windows: windows(&s),
        records: s.records.clone(),
        audit: s.audit.clone(),
        checkpoint: bytes,
        codec_bytes: encoded.len(),
        raw_record_bytes: s.records.len() * 15,
    })
}
pub fn json_process(bytes: &[u8]) -> Vec<u8> {
    let r = serde_json::from_slice::<Request>(bytes)
        .map_err(|e| e.to_string())
        .and_then(process);
    match r {
        Ok(v) => serde_json::to_vec(&v).unwrap(),
        Err(e) => serde_json::to_vec(&serde_json::json!({"error":e})).unwrap(),
    }
}
thread_local! {static OUTPUT:RefCell<Vec<u8>>=const{RefCell::new(Vec::new())};}
#[no_mangle]
pub extern "C" fn input_alloc(len: u32) -> *mut u8 {
    if len > 1500000 {
        return std::ptr::null_mut();
    }
    let mut data = vec![0u8; len as usize].into_boxed_slice();
    let ptr = data.as_mut_ptr();
    std::mem::forget(data);
    ptr
}
// ABI contract: caller supplies exactly one input_alloc buffer of this size, once.
#[no_mangle]
pub unsafe extern "C" fn run(ptr: *mut u8, len: u32) -> *const u8 {
    let data = Box::from_raw(std::ptr::slice_from_raw_parts_mut(ptr, len as usize));
    let out = json_process(&data);
    OUTPUT.with(|o| {
        *o.borrow_mut() = out;
        o.borrow().as_ptr()
    })
}
#[no_mangle]
pub extern "C" fn output_len() -> u32 {
    OUTPUT.with(|o| o.borrow().len() as u32)
}
#[cfg(test)]
mod tests {
    use super::*;
    fn config() -> Config {
        Config {
            width: 60,
            lag: 30,
            threshold: 5000,
        }
    }
    fn e(id: u32, time: u32, value: i32) -> Event {
        Event {
            id,
            sensor: 1,
            time,
            value,
        }
    }
    fn ingest(s: &mut State, event: Event) {
        let c = Command {
            id: format!("op{}", s.revision),
            revision: s.revision,
            action: Action::Ingest { event },
        };
        apply(s, &c).unwrap()
    }
    #[test]
    fn oracle_aggregates() {
        let mut s = new_state(config()).unwrap();
        for i in 1..=200 {
            ingest(&mut s, e(i, i * 5, (i as i32 * 17) % 7000));
        }
        let w = windows(&s);
        for x in w {
            let a: Vec<_> = s
                .records
                .iter()
                .filter(|r| {
                    r.accepted
                        && r.event.sensor == x.sensor
                        && r.event.time >= x.start
                        && r.event.time < x.end
                })
                .map(|r| r.event.value)
                .collect();
            assert_eq!(x.count, a.len() as u32);
            assert_eq!(x.sum, a.iter().map(|v| *v as i64).sum::<i64>());
            assert_eq!(x.max, *a.iter().max().unwrap());
            assert_eq!(x.min, *a.iter().min().unwrap())
        }
    }
    #[test]
    fn out_of_order_watermark() {
        let mut s = new_state(config()).unwrap();
        ingest(&mut s, e(1, 100, 10));
        ingest(&mut s, e(2, 80, 20));
        ingest(&mut s, e(3, 69, 30));
        assert_eq!(s.watermark, 70);
        assert!(!s.records[2].accepted);
        assert_eq!(windows(&s).iter().map(|w| w.count).sum::<u32>(), 2)
    }
    #[test]
    fn boundary_and_finalization() {
        let mut s = new_state(config()).unwrap();
        ingest(&mut s, e(1, 60, 6000));
        let c = Command {
            id: "wm".into(),
            revision: 1,
            action: Action::Advance { time: 120 },
        };
        apply(&mut s, &c).unwrap();
        assert!(windows(&s)[0].closed);
        assert!(windows(&s)[0].alert);
        ingest(&mut s, e(2, 119, 9000));
        assert_eq!(windows(&s)[0].count, 1);
        ingest(&mut s, e(3, 120, 400));
        assert_eq!(windows(&s).len(), 2)
    }
    #[test]
    fn duplicate_and_conflict() {
        let mut s = new_state(config()).unwrap();
        ingest(&mut s, e(1, 10, 1));
        ingest(&mut s, e(1, 10, 1));
        assert_eq!(s.records.len(), 1);
        assert_eq!(s.duplicates, 1);
        let c = Command {
            id: "conflict".into(),
            revision: 2,
            action: Action::Ingest { event: e(1, 10, 2) },
        };
        assert!(apply(&mut s, &c).unwrap_err().contains("conflict"));
        assert_eq!(s.revision, 2)
    }
    #[test]
    fn operations_idempotent_and_fenced() {
        let mut s = new_state(config()).unwrap();
        let c = Command {
            id: "x".into(),
            revision: 0,
            action: Action::Ingest { event: e(1, 10, 1) },
        };
        apply(&mut s, &c).unwrap();
        apply(&mut s, &c).unwrap();
        assert_eq!(s.revision, 1);
        let bad = Command {
            action: Action::Advance { time: 5 },
            ..c
        };
        assert!(apply(&mut s, &bad).is_err())
    }
    #[test]
    fn codec_differential_roundtrip() {
        let mut records = vec![];
        let mut seed = 81026u32;
        for i in 1..=1000 {
            seed = seed.wrapping_mul(1664525).wrapping_add(1013904223);
            records.push(Record {
                event: Event {
                    id: i,
                    sensor: (i % 3 + 1) as u16,
                    time: seed % 100000,
                    value: (seed % 2000000) as i32 - 1000000,
                },
                accepted: i % 3 != 0,
            })
        }
        assert_eq!(decode_records(&encode_records(&records)).unwrap(), records)
    }
    #[test]
    fn checkpoint_resume_equals_uninterrupted() {
        let mut a = new_state(config()).unwrap();
        for i in 1..=30 {
            ingest(&mut a, e(i, i * 7, 6000))
        }
        let mut b = restore(&checkpoint(&a).unwrap()).unwrap();
        for i in 31..=50 {
            ingest(&mut a, e(i, i * 7, 4000));
            ingest(&mut b, e(i, i * 7, 4000))
        }
        assert_eq!(a, b);
        assert_eq!(windows(&a), windows(&b));
        assert_eq!(checkpoint(&a).unwrap(), checkpoint(&b).unwrap())
    }
    #[test]
    fn corruption_and_truncation() {
        let s = new_state(config()).unwrap();
        let bytes = checkpoint(&s).unwrap();
        for n in 0..bytes.len() {
            assert!(restore(&bytes[..n]).is_err())
        }
        for n in 0..bytes.len() {
            let mut b = bytes.clone();
            b[n] ^= 1;
            assert!(restore(&b).is_err())
        }
    }
    #[test]
    fn json_boundary() {
        let input=br#"{"config":{"width":60,"lag":30,"threshold":5000},"commands":[{"id":"x","revision":0,"type":"ingest","event":{"id":1,"sensor":1,"time":10,"value":2}}]}"#;
        let v: serde_json::Value = serde_json::from_slice(&json_process(input)).unwrap();
        assert_eq!(v["accepted"], 1);
        assert!(v.get("error").is_none());
    }
    #[test]
    fn crc_reference() {
        assert_eq!(crc32(b"123456789"), 0xcbf43926)
    }
    #[test]
    fn invalid_varints_and_schema() {
        assert!(decode_records(&[0x80; 12]).is_err());
        assert!(decode_records(&[0, 1]).is_err());
        assert!(new_state(Config {
            width: 0,
            ..config()
        })
        .is_err());
        assert!(e(0, 0, 0).validate().is_err());
        assert!(e(1, 0, 1000001).validate().is_err())
    }
    #[test]
    fn review_gate() {
        let mut s = new_state(config()).unwrap();
        ingest(&mut s, e(1, 1, 6000));
        let mut c = Command {
            id: "review".into(),
            revision: 1,
            action: Action::Acknowledge {
                window: "1:0".into(),
                note: "Checked sensor trace".into(),
            },
        };
        assert!(apply(&mut s, &c).is_err());
        apply(
            &mut s,
            &Command {
                id: "wm".into(),
                revision: 1,
                action: Action::Advance { time: 60 },
            },
        )
        .unwrap();
        c.revision = 2;
        apply(&mut s, &c).unwrap();
        assert!(windows(&s)[0].acknowledged)
    }
}
