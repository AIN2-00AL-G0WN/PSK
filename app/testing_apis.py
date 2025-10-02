import asyncio
import httpx

BASE_URL = "http://localhost:8000"  # change as needed

# Replace with actual usernames/passwords of test users
users = [
    {"username": "user0@example.com", "password": "Rdl@12345"},
    {"username": "user7@example.com", "password": "Rdl@12345"},
]

async def login_and_get_token(client, username, password):
    data = {"username": username, "password": password}
    resp = await client.post(f"{BASE_URL}/auth/login", data=data)
    if resp.status_code == 200:
        return resp.json()["access_token"]
    else:
        print(f"Login failed for {username}: {resp.status_code} {resp.text}")
        return None

async def call_reserve(client, token):
    headers = {"Authorization": f"Bearer {token}"}
    data = {
        "tester_name": "Tester",
        "region": "Asia",
        "code_type": "OSV"
    }
    r = await client.post(f"{BASE_URL}/users/reserve", data=data, headers=headers)
    print("reserve:", r.status_code, r.json())

async def call_my_codes(client, token):
    headers = {"Authorization": f"Bearer {token}"}
    r = await client.get(f"{BASE_URL}/my", headers=headers)
    print("my codes:", r.status_code, r.json())

# async def call_release(client, token, code="CODE123", clearance_id="CLEAR123", note="test"):
#     headers = {"Authorization": f"Bearer {token}"}
#     data = {
#         "code": code,
#         "clearance_id": clearance_id,
#         "note": note
#     }
#     r = await client.post(f"{BASE_URL}/release", data=data, headers=headers)
#     print("release:", r.status_code, r.json())
#
# async def call_mark_non_usable(client, token, codes=["CODE123"], reason="broken"):
#     headers = {"Authorization": f"Bearer {token}"}
#     data = {
#         "codes": codes,
#         "reason": reason
#     }
#     r = await client.post(f"{BASE_URL}/mark-non-usable", data=data, headers=headers)
#     print("mark non usable:", r.status_code, r.json())

async def simulate_user(user):
    async with httpx.AsyncClient() as client:
        token = await login_and_get_token(client, user["username"], user["password"])
        if not token:
            return  # skip this user if login fails
        await call_reserve(client, token)
        await call_my_codes(client, token)
        # await call_release(client, token)
        # await call_mark_non_usable(client, token)

async def main():
    tasks = [simulate_user(user) for user in users]
    await asyncio.gather(*tasks)

if __name__ == "__main__":
    asyncio.run(main())
