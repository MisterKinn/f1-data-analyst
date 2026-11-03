import unittest
from collector import State, merge

class CollectorTests(unittest.TestCase):
    def test_sparse_merge_and_list_indices(self):
        initial=merge({}, {'Lines': {'99': {'Sectors': [{'Value':'20'}, {'Value':'30'}]}}})
        result=merge(initial, {'Lines': {'99': {'Sectors': {'1': {'Value':'31'}}}}})
        self.assertEqual(result['Lines']['99']['Sectors']['0']['Value'],'20')
        self.assertEqual(result['Lines']['99']['Sectors']['1']['Value'],'31')

    def test_initial_is_not_live(self):
        s=State();s.connected=True
        s.apply('SessionInfo',{'Key':1},initial=True)
        s.apply('SessionStatus',{'Status':'Started'},initial=True)
        self.assertFalse(s.snapshot()['feed_fresh'])
        from datetime import datetime, timezone
        now=datetime.now(timezone.utc).isoformat()
        s.apply('Heartbeat',{'Utc':now},now)
        s.apply('TimingData',{'Lines':{}},now)
        self.assertTrue(s.snapshot()['feed_fresh'])

    def test_session_reset_and_event_bound(self):
        s=State();s.apply('SessionInfo',{'Key':1})
        s.apply('TimingData',{'Lines':{'99':{'NumberOfLaps':5}}})
        run=s.run_id
        s.apply('SessionInfo',{'Key':2})
        self.assertNotIn('TimingData',s.topics)
        self.assertNotEqual(run,s.run_id)
        for i in range(450):s.apply('TimingData',{'Lines':{'99':{'NumberOfLaps':i}}})
        self.assertEqual(len(s.events),400)

    def test_secrets_not_topics(self):
        s=State();s.apply('Authorization',{'token':'TEST'})
        self.assertEqual(s.topics,{})

if __name__=='__main__': unittest.main()
