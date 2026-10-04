from tests.test_fares import fares_client, add_fare
import pytest
from datetime import date, datetime, timezone

PARAMS = {"origin": "DEL", "destination": "BOM", "departureDate": "2026-10-15"}


def test_extension_resolves_airports_and_compares_provided_price(fares_client):
    client, db = fares_client
    add_fare(db, 4000, days=60)
    add_fare(db, 6500, price_level="High", typical_price_low=5700, typical_price_high=6300)
    result = client.get('/api/tickety/insights', params={**PARAMS, "currentFare": 5240})
    assert result.status_code == 200
    data = result.json()
    assert data['route']['routeId'] == 'DELHI-MUMBAI'
    assert data['currentFare'] == 5240
    assert data['storedFare'] == 6500
    assert data['priceLevel'] == 'LOW'  # Not the unrelated stored search's High label.
    assert data['classificationBasis'] == 'observed_typical_range'
    assert data['differenceFromRange'] == -460
    assert data['lowestPrice'] == 4000
    assert data['leadTime'][1]['fare'] is None
    assert 'raw_payload' not in str(data)


def test_no_data_and_no_invented_classification(fares_client):
    client, db = fares_client
    data = client.get('/api/tickety/insights', params=PARAMS).json()
    assert data['hasData'] is False
    assert data['currentFare'] is None
    add_fare(db, price_level='Low')
    data = client.get('/api/tickety/insights', params={**PARAMS, 'currentFare': 9000}).json()
    assert data['priceLevel'] is None
    assert data['typicalPriceRange'] is None
    assert client.get('/api/tickety/insights', params=PARAMS).json()['priceLevel'] == 'LOW'


@pytest.mark.parametrize('params,status', [
    ({'origin':'XXX'},404), ({'origin':'BOM','destination':'DEL'},404),
    ({'destination':'DEL'},422), ({'origin':'DEL&x=bad'},422),
    ({'departureDate':'2026-02-30'},422), ({'currentFare':0},422),
    ({'currentFare':-2},422), ({'currentFare':'NaN'},422), ({'currentFare':'inf'},422),
])
def test_invalid_and_unsupported_context(fares_client,params,status):
    client, _ = fares_client
    assert client.get('/api/tickety/insights', params={**PARAMS, **params}).status_code == status


def test_incomparable_fares_stay_excluded(fares_client):
    client, db = fares_client
    add_fare(db, is_synthetic=True)
    add_fare(db, fare=2000, currency='USD')
    add_fare(db, fare=3000, cabin='business')
    assert client.get('/api/tickety/insights', params=PARAMS).json()['hasData'] is False


def test_invalid_range_and_case_normalization(fares_client):
    client, db = fares_client
    add_fare(db, typical_price_low=7000, typical_price_high=6000)
    data = client.get('/api/tickety/insights', params={**PARAMS,'origin':'del','currentFare':5000}).json()
    assert data['route']['origin'] == 'DEL'
    assert data['typicalPriceRange'] is None
    assert data['priceLevel'] is None


def test_diwali_window_has_exact_dates_latest_fares_and_honest_gaps(fares_client):
    client, db = fares_client
    add_fare(db, fare=1000, travel_date=date(2026,11,5), collected_at=datetime(2026,10,8,10,tzinfo=timezone.utc))
    add_fare(db, fare=5000, travel_date=date(2026,11,5), collected_at=datetime(2026,10,8,11,tzinfo=timezone.utc))
    add_fare(db, fare=9000, travel_date=date(2026,11,8), price_level='High')
    add_fare(db, fare=100, travel_date=date(2026,11,9), is_synthetic=True)
    data=client.get('/api/tickety/insights',params={**PARAMS,'departureDate':'2026-11-06'}).json()['eventContext']
    assert data['event']=={'name':'Diwali','date':'2026-11-08','travelOffset':-2}
    assert [d['offset'] for d in data['days']]==[-3,-2,-1,0,1,2,3]
    assert data['days'][0]['date']=='2026-11-05'
    assert data['days'][0]['fare']==5000
    assert data['days'][3]['priceLevel']=='HIGH'
    assert data['days'][4]['fare'] is None
    assert data['days'][6]['date']=='2026-11-11'


def test_calendar_coverage_and_three_days_after_event(fares_client):
    client,_=fares_client
    after=client.get('/api/tickety/insights',params={**PARAMS,'departureDate':'2026-11-11'}).json()['eventContext']
    assert after['event']['travelOffset']==3
    next_year=client.get('/api/tickety/insights',params={**PARAMS,'departureDate':'2027-11-01'}).json()['eventContext']
    assert next_year['coverageAvailable'] is True
    assert next_year['event']=={'name':'Diwali','date':'2027-10-29','travelOffset':3}
    assert next_year['sourceUrl']=='https://www.india.gov.in/calendar?date=2027'
