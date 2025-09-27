# PSK – Code Reservation & Management System

PSK is a **FastAPI**-based backend service for managing and distributing codes across teams.  
It supports **user authentication**, **team-based code allocation**, and **admin operations** such as releasing or marking codes as unusable.

---

## 🚀 Features

- **User Accounts**
  - Login with username & password
  - Team-based roles: `OSV`, `HSV`, `COMMON`
  - Admin support for management tasks

- **Code Management**
  - Reserve a code (team-specific first, fallback to common pool)
  - Confirm reserved codes
  - Release reserved codes back to pool
  - Disassociate in-use codes
  - Mark codes as non-usable

- **Logs & History**
  - Track reservations and releases
  - Fetch last 5 released codes
  - Query older logs with pagination (planned)

- **Robust Transactions**
  - Atomic DB operations with SQLAlchemy
  - Prevents double reservation under heavy load
  - Safe rollbacks on errors

---

## 🛠️ Tech Stack

- [FastAPI](https://fastapi.tiangolo.com/) – Web framework
- [PostgreSQL](https://www.postgresql.org/) – Database
- [SQLAlchemy ORM](https://www.sqlalchemy.org/) – ORM and transactions
- [Alembic](https://alembic.sqlalchemy.org/) – Database migrations
- [Pydantic](https://docs.pydantic.dev/) – Data validation

---

## 📂 Project Structure

```

PSK/
├── app/
│   ├── api/          # API routes (auth, codes, admin)
│   ├── core/         # Exceptions, configs, security
│   ├── db/           # Models, CRUD, engine
│   ├── schemas/      # Pydantic request/response models
│   └── main.py       # FastAPI app entry
├── scripts/          # DB seeders and helpers
├── requirements.txt  # Dependencies
└── README.md

````

---

## ⚡ Quick Start

### 1. Clone the repo
```bash
git clone https://github.com/AIN2-00AL-G0WN/PSK.git
cd PSK
````

### 2. Install PostgreSQL

* [Download & Install PostgreSQL](https://www.postgresql.org/download/)
* Make sure `psql` CLI is available in your terminal.
* Create a database named `promo`:

```bash
psql -U postgres
CREATE DATABASE promo;
```

### 3. Setup virtual environment

```bash
python -m venv venv
source venv/bin/activate   # On Windows: venv\Scripts\activate
```

### 4. Install dependencies

```bash
pip install -r requirements.txt
```

### 5. Configure environment

Create a `.env` file in project root:

```
DATABASE_URL=postgresql+psycopg2://postgres:yourpassword@localhost:5432/promo
SECRET_KEY=your_secret_key
ACCESS_TOKEN_EXPIRE_MINUTES=30
```

*(Replace `yourpassword` with your Postgres password)*

### 6. Run migrations

```bash
alembic upgrade head
```

### 7. Start server

```bash
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

---

## 📖 API Endpoints

### Auth

* `POST /auth/login` – User login
* `POST /auth/me` – User details
* `POST /auth/logout` – User logout

### Codes (User)

* `POST /users/reserve` – Reserve a code
* `GET /users/my` – List user’s reserved codes
* `POST /users/release` – Release reserved code
* `POST /users/mark-non-usable` – mark the code as non usable 


## 🔮 Future Improvements

* Better logging & analytics
* Caching layer for large-scale use
* Advanced search and pagination for admin
* Role-based access control with fine-grained permissions

---

## 🤝 Contributing

Contributions are welcome! Please open an issue or submit a PR.

---

## 📜 License

This project is licensed under the MIT License.

