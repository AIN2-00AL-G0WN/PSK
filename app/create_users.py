import asyncio
import httpx
import random
import string

BASE_URL = "http://localhost:8000"

teams = ["OSV", "HSV"]
PASSWORD = "Rdl@12345"

def random_username(length=8):
    return ''.join(random.choices(string.ascii_lowercase, k=length))

def random_email(num):
    return f"user{num}@example.com"

async def admin_login(client):
    data = {
        "username": "admin@example.com",
        "password": "Rdl@12345"
    }
    r = await client.post(f"{BASE_URL}/auth/login", data=data)
    r.raise_for_status()
    token = r.json().get("access_token")
    return token

async def create_user(client, token, team_name, user_name, contact_email, password, is_admin=False):
    data = {
        "team_name": team_name,
        "user_name": user_name,
        "contact_email": contact_email,
        "password": password,
        "is_admin": False
    }
    headers = {"Authorization": f"Bearer {token}"}
    response = await client.post(f"{BASE_URL}/admin/users/create", params=data, headers=headers)
    print(f"Create user {user_name}: {response.status_code} - {response.text}")

async def main():
    async with httpx.AsyncClient(timeout=30) as client:
        token = await admin_login(client)
        tasks = []
        for i in range(40):
            team_name = random.choice(teams)
            user_name = random_username()
            email = random_email(i)
            tasks.append(create_user(client, token, team_name, user_name, email, PASSWORD))
        await asyncio.gather(*tasks)

if __name__ == "__main__":
    asyncio.run(main())
