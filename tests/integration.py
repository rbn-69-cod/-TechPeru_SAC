"""HTTP contract/security regression tests. Run ONLY against an isolated APP_DEMO=1 database."""
import json, os, unittest, urllib.request, urllib.error, http.cookiejar, uuid
BASE = os.environ.get('TEST_BASE_URL', 'http://127.0.0.1:18080')
class Client:
    def __init__(self):
        self.http = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
        self.token = ''
    def call(self, path, method='GET', data=None, csrf=True):
        headers = {'Content-Type': 'application/json'}
        if csrf: headers['X-CSRF-Token'] = self.token
        request = urllib.request.Request(BASE + '/' + path, data=json.dumps(data).encode() if data is not None else None, headers=headers, method=method)
        try: response = self.http.open(request)
        except urllib.error.HTTPError as error: response = error
        raw = response.read().decode()
        result = json.loads(raw) if 'application/json' in response.headers.get('Content-Type', '') else raw
        if isinstance(result, dict) and result.get('csrf_token'): self.token = result['csrf_token']
        return response.status, result
    def login(self, email='admin@demo.com'):
        self.call('api/auth.php')
        status, result = self.call('api/auth.php?action=login', 'POST', {'email': email, 'password': 'BSC2026!'})
        assert status == 200, result
class API(unittest.TestCase):
    def setUp(self):
        self.c = Client(); self.c.login()
        self.suffix = uuid.uuid4().hex[:10]
    def create_objective(self):
        id = 'TEST-' + self.suffix
        status, result = self.c.call('api/objectives.php', 'POST', {'id': id, 'name': 'Prueba', 'perspective_id': 'financiera', 'leader': 'Líder de prueba'})
        self.assertEqual(status, 201, result)
        self.addCleanup(lambda: self.c.call('api/objectives.php?id=' + id, 'DELETE'))
        return id
    def create_kpi(self, obj=None):
        obj = obj or self.create_objective()
        id = 'K-' + self.suffix
        status, result = self.c.call('api/kpis.php', 'POST', {'id': id, 'name': 'Prueba KPI', 'objective_id': obj, 'unit': '%', 'target': 10, 'current_real': 5, 'responsible': 'Prueba', 'responsible_area': 'QA'})
        self.assertEqual(status, 201, result)
        return id
    def test_anonymous_cannot_read_or_write(self):
        c = Client()
        self.assertIsNone(c.call('api/auth.php')[1]['user'])
        for name in ['dashboard', 'objectives', 'kpis', 'measurements', 'initiatives', 'reports', 'admin', 'activity']:
            self.assertEqual(c.call('api/'+name+'.php')[0], 401, name)
            self.assertEqual(c.call('api/'+name+'.php', 'POST', {})[0], 401, name)
    def test_csrf_and_methods(self):
        self.assertEqual(self.c.call('api/objectives.php', 'POST', {}, False)[0], 403)
        self.assertEqual(self.c.call('api/auth.php?action=login')[0], 405)
        self.assertEqual(self.c.call('api/admin.php?action=reset')[0], 405)
        self.assertEqual(self.c.call('api/dashboard.php', 'POST', {})[0], 405)
    def test_role_permissions(self):
        c = Client(); c.login('responsable@demo.com')
        self.assertEqual(c.call('api/admin.php')[0], 403)
        self.assertEqual(c.call('api/objectives.php', 'POST', {})[0], 403)
        self.assertEqual(c.call('api/kpis.php')[0], 200)
    def test_objective_fields_and_perspective_propagation(self):
        obj = self.create_objective(); kpi = self.create_kpi(obj)
        self.assertEqual(self.c.call('api/objectives.php', 'PUT', {'id': obj, 'leader': 'Nuevo líder', 'perspective_id': 'clientes'})[0], 200)
        self.assertEqual(self.c.call('api/objectives.php?id='+obj)[1]['objective']['leader'], 'Nuevo líder')
        self.assertEqual(self.c.call('api/kpis.php?id='+kpi)[1]['kpi']['perspective_id'], 'clientes')
    def test_partial_update_and_duplicate(self):
        obj = self.create_objective()
        self.assertEqual(self.c.call('api/objectives.php', 'POST', {'id': obj, 'name': 'Duplicado', 'perspective_id': 'financiera'})[0], 409)
        self.assertEqual(self.c.call('api/objectives.php', 'PUT', {'id': obj, 'name': 'Actualizado'})[0], 200)
        record = self.c.call('api/objectives.php?id='+obj)[1]['objective']
        self.assertEqual(record['name'], 'Actualizado'); self.assertEqual(record['leader'], 'Líder de prueba')
    def test_validation(self):
        obj = self.create_objective()
        for changes in [{'name': ''}, {'weight': 'abc'}, {'weight': -2}, {'priority': 'unknown'}, {'name': ['bad']}]:
            self.assertEqual(self.c.call('api/objectives.php', 'PUT', {'id': obj, **changes})[0], 422)
        self.assertEqual(self.c.call('api/objectives.php', 'PUT', {'id': 'MISSING'})[0], 404)
        self.assertEqual(self.c.call('api/objectives.php', 'POST', {'id': '<script>', 'name': 'X', 'perspective_id': 'financiera'})[0], 422)
    def test_measurements_latest_duplicate_and_pagination(self):
        kpi = self.create_kpi()
        value = {'kpi_id': kpi, 'period': '2025-Q3', 'date': '2025-09-30', 'value': 8}
        self.assertEqual(self.c.call('api/measurements.php', 'POST', value)[0], 201)
        self.assertEqual(self.c.call('api/measurements.php', 'POST', value)[0], 409)
        self.assertEqual(self.c.call('api/measurements.php', 'POST', {**value, 'date': '2025-08-01', 'value': 2})[0], 201)
        self.assertEqual(self.c.call('api/kpis.php?id='+kpi)[1]['kpi']['current_real'], 8)
        self.assertEqual(self.c.call('api/measurements.php', 'POST', {**value, 'date': '2025-02-30'})[0], 422)
        self.assertEqual(self.c.call('api/measurements.php', 'POST', {**value, 'value': 'oops'})[0], 422)
        result = self.c.call('api/measurements.php?kpi_id='+kpi+'&limit=1&offset=1')[1]
        self.assertEqual(result['total'], 2); self.assertEqual(len(result['measurements']), 1)
    def test_zero_inverse_and_target_validation(self):
        kpi = self.create_kpi()
        self.assertEqual(self.c.call('api/kpis.php', 'PUT', {'id': kpi, 'target': 0})[0], 422)
        result = self.c.call('api/kpis.php', 'PUT', {'id': kpi, 'direction': 'menor', 'current_real': 0})
        self.assertEqual(result[0], 200); self.assertEqual(result[1]['compliance_pct'], 100)
    def test_deleting_objective_is_atomic_and_complete(self):
        obj = self.create_objective(); kpi = self.create_kpi(obj)
        self.c.call('api/measurements.php', 'POST', {'kpi_id': kpi, 'period': '2025-Q3', 'date': '2025-09-30', 'value': 2})
        created = self.c.call('api/initiatives.php', 'POST', {'objective_id': obj, 'kpi_id': kpi, 'name': 'Iniciativa', 'leader': 'Líder'})
        self.assertEqual(created[0], 201)
        self.assertEqual(self.c.call('api/objectives.php?id='+obj, 'DELETE')[0], 200)
        self.assertEqual(self.c.call('api/kpis.php?id='+kpi)[0], 404)
        self.assertEqual(self.c.call('api/measurements.php?kpi_id='+kpi)[1]['total'], 0)
        self.assertEqual(self.c.call('api/initiatives.php?id='+created[1]['id'])[0], 404)
    def test_initiative_validation_and_updates(self):
        obj = self.create_objective()
        value = {'objective_id': obj, 'name': 'Proyecto', 'leader': 'QA'}
        self.assertEqual(self.c.call('api/initiatives.php', 'POST', {**value, 'progress_pct': 101})[0], 422)
        self.assertEqual(self.c.call('api/initiatives.php', 'POST', {**value, 'start_date': '2025-02-01', 'end_date': '2025-01-01'})[0], 422)
        result = self.c.call('api/initiatives.php', 'POST', value)[1]
        self.assertEqual(self.c.call('api/initiatives.php', 'PUT', {'id': result['id'], 'budget': 25})[0], 200)
        self.assertEqual(self.c.call('api/initiatives.php?id='+result['id'])[1]['initiative']['budget'], 25)
    def test_reports_and_protected_files(self):
        for path in ['api/reports.php?action=print_html', 'api/reports.php?action=export_csv', 'api/reports.php', 'api/dashboard.php']:
            self.assertEqual(self.c.call(path)[0], 200)
        for path in ['database/bsc.sqlite', '.env', 'config/app.php', 'api/common.php', 'storage/bsc.before-audit.sqlite', '.git/config']:
            self.assertEqual(self.c.call(path)[0], 404, path)
    def test_logout(self):
        self.assertEqual(self.c.call('api/auth.php?action=logout', 'POST', {})[0], 200)
        self.assertEqual(self.c.call('api/kpis.php')[0], 401)
    def test_login_throttle(self):
        c = Client(); c.call('api/auth.php')
        for _ in range(10):
            self.assertEqual(c.call('api/auth.php?action=login', 'POST', {'email': self.suffix+'@invalid.test', 'password': 'bad'})[0], 401)
        self.assertEqual(c.call('api/auth.php?action=login', 'POST', {'email': self.suffix+'@invalid.test', 'password': 'bad'})[0], 429)
if __name__ == '__main__': unittest.main(verbosity=2)
