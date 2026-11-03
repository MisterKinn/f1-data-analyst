import unittest
from championship import normalize

class ChampionshipTests(unittest.TestCase):
    def test_driver_points_and_constructor_names(self):
        item={'position':'1','points':'12.5','Driver':{'givenName':'First','familyName':'Last'},'Constructors':[{'name':'Team'}]}
        result=normalize([{'season':'2026','round':'18','DriverStandings':[item]}],'drivers',2026)
        self.assertEqual(result['categories'][0]['rows'][0]['points'],12.5)
        self.assertEqual(result['categories'][0]['rows'][0]['team'],'Team')
        with self.assertRaises(ValueError):normalize([{'season':'2025'}],'drivers',2026)
        item['points']='NaN'
        with self.assertRaises(ValueError):normalize([{'season':'2026','round':'18','DriverStandings':[item]}],'drivers',2026)

    def test_constructor_totals_are_not_summed_from_drivers(self):
        result=normalize([{'season':'2026','round':'18','ConstructorStandings':[{'position':'1','points':'0','Constructor':{'name':'Team'}}]}],'constructors',2026)
        self.assertEqual(result['categories'][0]['rows'][0]['points'],0)
