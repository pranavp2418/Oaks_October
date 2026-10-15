"""Opt-in, zero-price hosted integration pilot; outputs real receipts, no secrets.

Usage: python live_pilot.py https://morrowstock-20261014.vercel.app
The API checks catalog price before every inference. No paid model/fallback.
"""
import json
import sys
import time
from datetime import datetime, timezone
from urllib.request import Request, urlopen
from urllib.error import HTTPError


def post(base, body):
    try:
        with urlopen(Request(base.rstrip('/') + '/api/workspace', json.dumps(body).encode(),
                             {'Content-Type': 'application/json'}), timeout=55) as response:
            return response.status, json.load(response)
    except HTTPError as error:
        return error.code, json.load(error)


def main():
    base = sys.argv[1]
    data = {'lots': [
        {'id': 'ROOT-EARLY', 'sku': 'ROOT', 'quantity': 5, 'arrival': 0, 'expiry': 3, 'location': 0},
        {'id': 'ROOT-LATE', 'sku': 'ROOT', 'quantity': 5, 'arrival': 1, 'expiry': 5, 'location': 2}],
        'orders': [
        {'id': 'ROOT-HIGH', 'sku': 'ROOT', 'quantity': 6, 'due': 2, 'priority': 5, 'location': 1},
        {'id': 'ROOT-LOW', 'sku': 'ROOT', 'quantity': 6, 'due': 3, 'priority': 1, 'location': 2}]}
    questions = [
        ('shortage', 'Inspect inventory, then use optimize_allocation to explain which ROOT order is short and by how many cases. Finish with evidence citations. Never reserve stock.', 'optimize_allocation'),
        ('replenishment', 'Inspect inventory and use propose_replenishment to suggest ROOT cases needed. Cite evidence and finish. Do not create any purchase.', 'propose_replenishment'),
        ('exposure', 'Inspect inventory and use trace_lot for ROOT-EARLY to report current recall exposure. Cite evidence and finish. Never recall or release stock.', 'trace_lot')]
    report = {'recorded_at': datetime.now(timezone.utc).isoformat(), 'base_url': base,
              'kind': 'real_hosted_small_integration_pilot_not_held_out', 'cases': [], 'passed': False}
    for label, goal, required in questions:
        status, result = post(base, {'command': {'id': label + '-import', 'kind': 'import', 'args': {'data': data}}})
        assert status == 200, (status, result)
        workspace = result['workspace']
        stock = result['state']
        steps = []
        for step in range(4):
            command = {'id': f'{label}-step-{step}', 'kind': 'agent_start' if step == 0 else 'agent_continue',
                       'args': {'run_id': label, **({'goal': goal} if step == 0 else {})}}
            started = time.perf_counter()
            status, result = post(base, {'workspace': workspace, 'command': command})
            steps.append({'http_status': status, 'elapsed_ms': round((time.perf_counter() - started) * 1000, 2)})
            if status != 200:
                report['cases'].append({'label': label, 'passed': False, 'steps': steps, 'error': result})
                print(json.dumps(report, indent=2)); return 1
            workspace = result['workspace']
            assert result['state'] == stock, 'Read-only agent changed stock state'
            agent = result['agents'][0]
            if agent.get('summary'):
                break
        agent = result['agents'][0]
        status, reviewed = post(base, {'workspace': workspace, 'command': {'id': label + '-review',
            'kind': 'agent_review', 'args': {'run_id': label}}})
        if status != 200:
            report['cases'].append({'label': label, 'passed': False, 'error': reviewed})
            print(json.dumps(report, indent=2)); return 1
        replay_status, replay = post(base, {'workspace': reviewed['workspace']})
        assert replay_status == 200 and replay['agents'][0] == reviewed['agents'][0], 'Replay changed agent'
        tools = [o['tool'] for o in agent['observations']]
        receipts = [d['provider'] for d in agent['decisions']]
        final = reviewed['agents'][0]
        passed = required in tools and bool(agent.get('summary', {}).get('citations')) and len(receipts) <= 4
        passed = passed and final['status'] == 'REVIEWED_EVIDENCE' and final['checkpoint_pending'] == []
        passed = passed and all(r.get('generation_id') and r.get('usage') and r['usage'].get('cost') == 0 for r in receipts)
        report['cases'].append({'label': label, 'goal': goal, 'passed': passed, 'steps': steps,
            'tools': tools, 'observations': agent['observations'], 'provider_receipts': receipts,
            'summary': agent.get('summary'), 'final_status': final['status'],
            'replay_equal': True, 'stock_unchanged': True})
        if not passed:
            print(json.dumps(report, indent=2)); return 1
    report['passed'] = True
    print(json.dumps(report, indent=2))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
