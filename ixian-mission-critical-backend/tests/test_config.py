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


def test_cors_origins_accept_comma_separated_string():
    settings = Settings(
        BACKEND_CORS_ORIGINS=(
            "http://localhost:3000, https://todos.purecambo.org, "
            "http://192.168.5.173:3000"
        )
    )

    assert settings.BACKEND_CORS_ORIGINS == [
        "http://localhost:3000",
        "https://todos.purecambo.org",
        "http://192.168.5.173:3000",
    ]
