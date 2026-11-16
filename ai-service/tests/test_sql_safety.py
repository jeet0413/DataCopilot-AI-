import pytest

from sql_safety import UnsafeSQLError, validate_select_sql

T = "ds_" + "a" * 32


def ok(sql):
    return validate_select_sql(sql, T)


def bad(sql):
    with pytest.raises(UnsafeSQLError):
        validate_select_sql(sql, T)


def test_accepts_plain_select_and_strips_fences_and_semicolon():
    assert "SELECT" in ok(f"```sql\nSELECT * FROM {T} LIMIT 5;\n```").upper()


def test_accepts_aggregates_cte_and_quoted_table():
    ok(f'SELECT category, SUM(price) AS s FROM "{T}" GROUP BY category ORDER BY s DESC LIMIT 10')
    ok(f"WITH x AS (SELECT * FROM {T}) SELECT COUNT(*) FROM x")
    ok(f"SELECT a.price FROM {T} a WHERE a.name LIKE '%laptop%' AND a.note <> ':foo'")
    ok(f"SELECT price::numeric / 2 FROM user_data.{T}")


@pytest.mark.parametrize("sql", [
    "DROP TABLE users",
    f"DELETE FROM {T}",
    f"UPDATE {T} SET a = 1",
    f"INSERT INTO {T} VALUES (1)",
    f"SELECT * FROM {T}; DROP TABLE {T}",
    f"SELECT * INTO newtable FROM {T}",
    f"SELECT * FROM {T} FOR UPDATE",
    "SELECT * FROM users",
    "SELECT * FROM public.users",
    f"SELECT * FROM {T}, users",
    f"SELECT * FROM {T} JOIN ds_{'b' * 32} ON true",
    f"SELECT * FROM {T} WHERE id IN (SELECT id FROM users)",
    "SELECT * FROM pg_catalog.pg_user",
    "SELECT * FROM information_schema.tables",
    f"SELECT pg_sleep(10) FROM {T}",
    f"SELECT pg_read_file('/etc/passwd') FROM {T}",
    f"SELECT set_config('x','y',false) FROM {T}",
    f"SELECT version() FROM {T}",
    f"SELECT * FROM generate_series(1, 1000000000)",
    f"SELECT * FROM {T} CROSS JOIN LATERAL (SELECT 1) z",
    "COPY (SELECT 1) TO '/tmp/x'",
    "SET search_path = public",
    "",
    "   ",
])
def test_rejects_unsafe(sql):
    bad(sql)


def test_rejects_wrong_table_name_argument():
    with pytest.raises(UnsafeSQLError):
        validate_select_sql("SELECT 1", "users")
    with pytest.raises(UnsafeSQLError):
        validate_select_sql("SELECT 1", "ds_xyz")
