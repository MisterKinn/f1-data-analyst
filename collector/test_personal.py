import unittest
from unittest.mock import patch, Mock
import personal

class PersonalTests(unittest.TestCase):
    def manager(self):
        with patch('personal.threading.Thread'), patch('personal.atexit.register'):
            return personal.PersonalSessions()

    def test_unknown_session_never_returns_shared(self):
        manager = self.manager()
        data, status = manager.request('account-a', '/snapshot', 'GET')
        self.assertEqual(status, 200)
        self.assertIsNone(data['snapshot'])
        self.assertEqual(data['collector']['state'], 'credentials_required')
        self.assertEqual(manager.request('../escape', '/snapshot', 'GET')[1], 400)

    def test_login_isolated_and_credentials_not_returned(self):
        manager = self.manager()
        process = Mock(pid=12345)
        with patch('personal.subprocess.run', return_value=Mock(returncode=0)) as auth, patch('personal.subprocess.Popen', return_value=process) as start:
            with patch.dict('os.environ', {'F1_PASSWORD':'OWNER_SECRET','WEC_PASSWORD':'OWNER_WEC','CALLBACK_URL':'https://owner.test'}):
                result, status = manager.login('account-a', {'username':'a@test','password':'PERSONAL_TEST'})
            self.assertEqual(status, 200)
            environment = start.call_args.kwargs['env']
            self.assertEqual(environment['F1_PASSWORD'], 'PERSONAL_TEST')
            self.assertNotIn('WEC_PASSWORD', environment)
            self.assertNotIn('CALLBACK_URL', environment)
            self.assertEqual(environment['PERSONAL_F1_CHILD'], '1')
            self.assertNotIn('password', str(result))
            self.assertNotIn('password', manager.sessions['account-a'])
            directory = manager.sessions['account-a']['directory']
        with patch('personal.os.killpg', create=True):
            manager.remove('account-a')
        self.assertFalse(personal.Path(directory).exists())

    def test_failed_login_rate_limit_and_capacity(self):
        manager = self.manager()
        with patch('personal.subprocess.run', return_value=Mock(returncode=21)):
            for _ in range(5):
                self.assertEqual(manager.login('a', {'username':'a','password':'wrong'})[1], 401)
            self.assertEqual(manager.login('a', {'username':'a','password':'wrong'})[1], 429)
        self.assertFalse(manager.sessions)
        manager.limit=1
        manager.sessions['occupied']={}
        self.assertEqual(manager.login('b', {'username':'b','password':'test'})[1],503)
