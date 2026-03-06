# Bitespeed Backend Task — Identity Reconciliation

A backend service that identifies and links multiple customer identities using **email** and **phone number**, ensuring purchases made with different contact information are mapped to the same customer.

---

## Live API

| | |
|---|---|
| **Base URL** | [https://bitespeed-backend-task-aifq.onrender.com](https://bitespeed-backend-task-aifq.onrender.com) |
| **Endpoint** | `POST /identify` |
| **Full URL** | [https://bitespeed-backend-task-aifq.onrender.com/identify](https://bitespeed-backend-task-aifq.onrender.com/identify) |

---

## Problem

Customers may place orders using different **emails** or **phone numbers** across purchases. The system must detect when these contacts belong to the same user and **link them under a single primary identity**.

Contacts are linked if they share either a common **email** or **phone number**. The oldest contact becomes the **primary contact**, while newer linked contacts become **secondary contacts**.

---

## API Specification

### Request

```http
POST /identify
Content-Type: application/json
```

```json
{
  "email": "string",
  "phoneNumber": "string"
}
```

> At least **one field** must be provided.

### Response

```json
{
  "contact": {
    "primaryContactId": 1,
    "emails": ["string"],
    "phoneNumbers": ["string"],
    "secondaryContactIds": [number]
  }
}
```

- The **first** email/phone in each array corresponds to the **primary contact**
- Remaining entries correspond to **secondary contacts**

### Example

**Request**
```json
{
  "email": "mcfly@hillvalley.edu",
  "phoneNumber": "123456"
}
```

**Response**
```json
{
  "contact": {
    "primaryContactId": 1,
    "emails": [
      "lorraine@hillvalley.edu",
      "mcfly@hillvalley.edu"
    ],
    "phoneNumbers": [
      "123456"
    ],
    "secondaryContactIds": [23]
  }
}
```

---

## Identity Reconciliation Logic

### 1. New User
If no contact exists with the provided email or phone number, a new **primary contact** is created.

### 2. Existing Contact
If a matching contact already exists, the consolidated identity is returned.

### 3. New Information for Existing Contact
If new contact info is provided alongside a known identifier, a **secondary contact** is created and linked to the primary.

```
Existing:  email = a@gmail.com, phone = 123
Request:   email = b@gmail.com, phone = 123
Result:    secondary contact created, linked to primary
```

### 4. Merging Two Primary Contacts
If a new request connects two previously separate identities, the older contact remains **primary** and the newer one becomes **secondary**. All of the newer primary's existing secondary contacts are **cascadingly re-linked** to the oldest primary in a single operation.

```
Before:  Primary A (id: 11) ← Secondary A1, A2
         Primary B (id: 27) ← Secondary B1

Request links A and B:
After:   Primary A (id: 11) ← Secondary A1, A2, B (demoted), B1 (re-linked)
```

---

## Flow Diagram

```
POST /identify
      │
      ▼
┌─────────────────────────┐
│ Both email & phone null? │──── YES ──► 400 Bad Request
└─────────────────────────┘
      │ NO
      ▼
┌──────────────────────────────┐
│ Any matching contact exists? │──── NO ──► Create new PRIMARY contact
└──────────────────────────────┘               └─► Return consolidated response
      │ YES
      ▼
┌───────────────────────────────────┐
│ Is ALL provided info already known│
│ (no new email or phone)?          │──── YES ──► Return existing consolidated response
└───────────────────────────────────┘
      │ NO (new info present)
      ▼
┌──────────────────────────────────────┐
│ Do matches belong to 2 separate      │
│ primary contacts?                    │──── YES ──► Demote newer primary to SECONDARY
└──────────────────────────────────────┘             Cascade re-link all its secondaries
      │ NO                                           └─► Return consolidated response
      ▼
Create new SECONDARY contact linked to primary
      │
      ▼
Return consolidated response
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js |
| Framework | Express.js |
| Database | PostgreSQL |
| ORM | Prisma |
| Hosting | Render |

---

## Project Structure

```
project/
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── src/
│   ├── services/
│   │   └── identityService.js
│   ├── prisma.js
│   └── server.js
├── .env
├── package.json
└── README.md
```

---

## Running Locally

**1. Clone the repository**
```bash
git clone https://github.com/averageguy989/Bitespeed-Backend-Task
cd Bitespeed-Backend-Task
```

**2. Install dependencies**
```bash
npm install
```

**3. Configure environment variables**
```env
DATABASE_URL=postgresql://username:password@localhost:5432/bitespeed
PORT=3000
```

**4. Run database migrations**
```bash
npx prisma migrate dev
```

**5. Start the server**
```bash
npm start
```

Server runs at `http://localhost:3000`

---

## Quick API Test

```bash
curl -X POST https://bitespeed-backend-task-aifq.onrender.com/identify \
  -H "Content-Type: application/json" \
  -d '{"email":"doc@fluxkart.com","phoneNumber":"123456"}'
```

---

## Test Scenarios Covered

- New user identity creation
- Existing email lookup
- Existing phone lookup
- New email with existing phone
- New phone with existing email
- Duplicate request handling
- Merging two primary contacts
- Cascading re-linking of all secondaries when two primaries merge

---

## Error Handling

| Scenario | HTTP Status | Response |
|---|---|---|
| Both `email` and `phoneNumber` are null/missing | `400` | `{ "error": "At least one of email or phoneNumber must be provided" }` |
| Invalid JSON body | `400` | `{ "error": "Invalid request body" }` |
| Database unreachable | `500` | `{ "error": "Internal server error" }` |

All successful requests — whether they create a new contact, link existing ones, or simply look up — return `200` with the consolidated contact payload.

---

## Known Limitation

The task specification does not explicitly define behavior when a primary contact was created with only one identifier (e.g., just an email) and a subsequent request provides the **same identifier plus a new one** (e.g., same email + a phone number).

The current implementation follows a conservative approach: any new information triggers a **secondary contact** creation rather than mutating the existing primary. This keeps the primary record immutable post-creation, which avoids unintended data overwrites.

```
Request 1: { "email": "a@gmail.com" }
→ Primary contact created (phone: null)

Request 2: { "email": "a@gmail.com", "phoneNumber": "123" }
→ Secondary contact created and linked to primary
  (rather than patching the primary's null phone field)
```

**Proposed improvement:** If the incoming request introduces exactly one new field and the matching contact has `null` for that field, patch the primary directly instead of creating a secondary. This would reduce unnecessary contact rows for the same identity.

---

## Author

**Chandru**

[![GitHub Repo](https://img.shields.io/badge/GitHub-Bitespeed--Backend--Task-181717?style=for-the-badge&logo=github)](https://github.com/averageguy989/Bitespeed-Backend-Task)
