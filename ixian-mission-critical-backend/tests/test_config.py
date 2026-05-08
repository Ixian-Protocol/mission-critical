"""Settings parsing tests."""

from app.core.config import Settings


def test_cors_origins_accept_json_array_string():
    settings = Settings(
        BACKEND_CORS_ORIGINS=(
            '["http://localhost:3000","https://todos.purecambo.org",'
            '"http://192.168.5.173:3000"]'
        )
    )

    assert settings.BACKEND_CORS_ORIGINS == [
        "http://localhost:3000",
        "https://todos.purecambo.org",
        "http://192.168.5.173:3000",
    ]


def test_cors_origin_regex_optional():
    s = Settings(
        BACKEND_CORS_ORIGINS="http://localhost:3000",
        BACKEND_CORS_ORIGIN_REGEX=r"^http://192\.168\.[0-9]+\.[0-9]+:[0-9]+",
    )
    assert s.BACKEND_CORS_ORIGIN_REGEX is not None
    assert s.BACKEND_CORS_ORIGINS == ["http://localhost:3000"]


def test_cors_origin_regex_blank_means_disabled():
    s = Settings(BACKEND_CORS_ORIGINS="http://localhost:3000", BACKEND_CORS_ORIGIN_REGEX="  ")
    assert s.BACKEND_CORS_ORIGIN_REGEX is None
