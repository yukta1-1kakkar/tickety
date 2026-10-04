from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def test_deployed_frontend_origin_is_allowed():
    response = client.options(
        "/api/health",
        headers={
            "Origin": "https://tickety-airfare.vercel.app",
            "Access-Control-Request-Method": "GET",
        },
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "https://tickety-airfare.vercel.app"
    assert response.headers["access-control-allow-credentials"] == "true"


def test_unknown_origin_is_not_allowed():
    response = client.options(
        "/api/health",
        headers={
            "Origin": "https://example.invalid",
            "Access-Control-Request-Method": "GET",
        },
    )

    assert "access-control-allow-origin" not in response.headers
