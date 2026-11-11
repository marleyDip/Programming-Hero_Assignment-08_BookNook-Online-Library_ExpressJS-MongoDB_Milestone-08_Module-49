# 📚 BookNook - Online Library Management System

**BookNook** is a full-stack online library management platform where users can discover books, share their own books, borrow books from other users, and manage their borrowing activities.

The platform provides a simple and user-friendly experience for managing personal book collections and borrowing books while maintaining accurate book availability through a transaction-based borrowing and returning system.

> **Express & MongoDB** REST API for the BookNook online library, written in **TypeScript**.

> Built as **Assignment 08 · Milestone 08 · Module 49** of the Programming Hero **_AI-Driven Full Stack Web Engineering Course Level-1 Batch-14_** course.

## Structure

```text
api/
  index.ts                  Vercel serverless entry
src/
  app.ts                    Express app (middleware + routes + error handling)
  server.ts                 Local / non-serverless entry (app.listen)
  config/                   env, MongoDB client + collections, CORS
  constants/                categories, conditions, sort options, limits
  types/                    document types, Express Request augmentation
  middlewares/              auth (JWT), db connection, error handling
  validators/               request payload validation
  controllers/              request handlers (book, borrow, newsletter, health)
  routes/                   routers, one per resource
  utils/                    AppError, asyncHandler, response, parsing, transactions
  scripts/createIndexes.ts  one-off MongoDB index setup
```

## Scripts

| Command                 | What it does                          |
| ----------------------- | ------------------------------------- |
| `npm run dev`           | Start with auto-restart (nodemon + tsx) |
| `npm run build`         | Compile to `dist/`                    |
| `npm start`             | Run the compiled server               |
| `npm run typecheck`     | Type-check without emitting           |
| `npm run db:indexes`    | Create MongoDB indexes                |

## Setup

```bash
cp .env.example .env   # then fill in the values
npm install
npm run db:indexes
npm run dev
```

## Endpoints

| Method | Path                       | Auth | Description                       |
| ------ | -------------------------- | ---- | --------------------------------- |
| GET    | `/api/books`               | No   | Filter, search, sort, paginate    |
| GET    | `/api/books/latest`        | No   | 8 newest books                    |
| GET    | `/api/books/:id`           | Yes  | Book details                      |
| POST   | `/api/books`               | Yes  | Add a book                        |
| PUT    | `/api/books/:id`           | Yes  | Update a book (owner only)        |
| DELETE | `/api/books/:id`           | Yes  | Delete a book (owner only)        |
| GET    | `/api/my-books`            | Yes  | Books owned by the current user   |
| POST   | `/api/borrows`             | Yes  | Borrow a book `{ bookId }`        |
| GET    | `/api/borrows`             | Yes  | Current user's borrowing history  |
| PATCH  | `/api/borrows/:id/return`  | Yes  | Return a borrowed book            |
| POST   | `/api/newsletter`          | No   | Subscribe `{ email }`             |
| GET    | `/api/health`              | No   | API + database shealth            |

---

## ✨ Key Features

### 🔐 Authentication & Authorization

- Secure user authentication with Better Auth.
- Support for social authentication providers.
- JWT-based API authentication.
- Protected API endpoints for authenticated users.
- Ownership-based authorization for managing books.
- User identity is verified on the backend rather than trusted from client-provided email addresses.

### 📖 Book Discovery

- Browse all available books.
- View the latest books added to the platform.
- Search books by title and author.
- Filter books by category.
- Sort books using supported sorting options.
- Paginated book listings.
- View detailed information about individual books.
- Display book cover images and descriptions.

### 📚 Book Management

- Add new books to the library.
- Upload and manage book cover images.
- Edit existing book information.
- Delete books owned by the authenticated user.
- Manage total and available copies.
- Store book information, including:
  - Title
  - Author
  - Category
  - Cover image
  - Description
  - ISBN
  - Publication year
  - Language
  - Book condition
  - Total copies
  - Available copies
- Automatically associate newly added books with the authenticated user.
- Prevent unauthorized users from modifying or deleting another user's books.
- Prevent deletion when copies are currently borrowed.

### 🔄 Borrowing & Returning System

- Borrow books from other users.
- Prevent users from borrowing their own books.
- Prevent duplicate active borrowings of the same book by the same user.
- Automatically decrease available copies after a successful borrowing.
- Automatically calculate the expected return date.
- View personal borrowing records.
- Return previously borrowed books.
- Automatically restore available copies after a successful return.
- Maintain borrowing history and return status.
- Handle concurrent borrowing and returning operations safely using MongoDB transactions.

### 👤 Personal Dashboard

- View books added by the authenticated user.
- Manage personal book collections.
- Edit and delete owned books.
- View borrowed books.
- Track borrowing and return dates.
- Monitor borrowing status.

### 📩 Newsletter

- Subscribe using an email address.
- Prevent duplicate subscriptions.
- Store subscriber information in MongoDB.
- Handle duplicate subscription requests safely.

### ⚡ API & Data Management

- RESTful API architecture.
- Consistent JSON response structure.
- Server-side input validation.
- Centralized authentication middleware.
- Ownership verification.
- Atomic MongoDB update operations.
- MongoDB transactions for borrowing and returning.
- Database indexing for efficient queries and data integrity.
- Pagination and sorting for book listings.
- Standard HTTP status codes and error handling.

---

## 🛠️ Technology Stack

### Frontend

- Next.js
- React
- TypeScript
- Tailwind CSS
- shadcn/ui
- Framer Motion
- Sonner
- Better Auth

### Backend

- Node.js
- Express.js
- TypeScript
- MongoDB
- MongoDB Node.js Driver
- Better Auth JWT verification
- JOSE

### Database

- MongoDB Atlas
- MongoDB Transactions
- MongoDB Indexes

### Development & Deployment

- Git
- GitHub
- Vercel
- Environment Variables

---

## 🏗️ Project Architecture

BookNook follows a client-server architecture.

```text
                 ┌─────────────────────┐
                 │     BookNook UI     │
                 │      Next.js        │
                 └──────────┬──────────┘
                            │
                            │ HTTP Requests
                            │ JWT Authorization
                            ▼
                 ┌─────────────────────┐
                 │    Express API      │
                 │   Authentication    │
                 │    Validation       │
                 │  Business Logic     │
                 └──────────┬──────────┘
                            │
                            │ MongoDB Driver
                            ▼
                 ┌─────────────────────┐
                 │      MongoDB        │
                 │                     │
                 │      books          │
                 │    borrowings       │
                 │    subscribers      │
                 └─────────────────────┘
```

---

## 📂 Database Collections

BookNook uses three primary MongoDB collections.

| Collection | Purpose |
| --- | --- |
| `books` | Stores book details, ownership, and copy availability. |
| `borrowings` | Stores borrowing records, due dates, and return status. |
| `subscribers` | Stores newsletter subscriber information. |

### Book Document

```json
{
  "_id": "ObjectId",
  "title": "The Alchemist",
  "author": "Paulo Coelho",
  "category": "Fiction",
  "image": "https://example.com/book-cover.jpg",
  "description": "A journey of self-discovery.",
  "totalCopies": 5,
  "availableCopies": 4,
  "isbn": "9780061122415",
  "publishedYear": 1988,
  "language": "English",
  "condition": "Good",
  "ownerName": "Book Owner", 
  "ownerEmail": "owner@example.com",
  "createdAt": "2026-01-01T10:00:00.000Z"
}
```

### Borrowing Document

```json
{
  "_id": "ObjectId",
  "bookId": "ObjectId",
  "bookTitle": "The Alchemist",
  "bookAuthor": "Paulo Coelho",
  "bookImage": "https://example.com/book-cover.jpg",
  "userEmail": "reader@example.com",
  "userName": "Reader",
  "borrowDate": "2026-01-01T10:00:00.000Z",
  "returnDate": "2026-01-15T10:00:00.000Z",
  "returnedAt": null,
  "status": "borrowed"
}
```

### Subscriber Document

```json
{
  "_id": "ObjectId",
  "email": "subscriber@example.com",
  "createdAt": "2026-01-01T10:00:00.000Z"
}
```

---

## 🔒 Database Indexing & Data Integrity

BookNook uses MongoDB indexes to improve query performance and maintain data consistency.

Important indexes include:

- Book ownership and listing indexes.
- Borrowing lookup indexes using `bookId` and `status`.
- Unique partial index on `bookId` and `userEmail` for active borrowings.
- Unique email index for newsletter subscribers.

The unique partial borrowing index allows users to borrow the same book again after returning it, while preventing multiple active borrowing records for that book.

### Transaction-Based Borrowing

Borrowing and returning operations use MongoDB transactions to keep book availability and borrowing records synchronized.

For example, a borrowing operation performs the following steps:

1. Verify that the book exists.
2. Check whether the user already has an active borrowing.
3. Verify that copies are available.
4. Decrease the available copy count.
5. Insert the borrowing record.
6. Commit the transaction.

If an operation fails, the transaction is rolled back to prevent inconsistent database records.

---

## 🚀 Getting Started

Follow these instructions to run BookNook locally.

### Prerequisites

Make sure you have installed:

- Node.js
- npm
- MongoDB Atlas account or a local MongoDB instance
- Git

### 1. Clone the Repository

Clone the frontend and backend repositories.

```bash
git clone <YOUR_FRONTEND_REPOSITORY_URL>
git clone <YOUR_BACKEND_REPOSITORY_URL>
```

### 2. Backend Setup

Navigate to the backend directory:

```bash
cd booknook-server
```

Install dependencies:

```bash
npm install
```

Create a `.env` file in the backend root directory:

```env
PORT=8000

MONGODB_URI=your_mongodb_connection_string
DB_NAME=booknook

BETTER_AUTH_URL=http://localhost:3000
CLIENT_URL=http://localhost:3000
```

Configure the actual Better Auth URL and frontend origins for your deployment environment.

Start the backend development server:

```bash
npm run dev
```

The API will be available at:

```text
http://localhost:8000
```

### 3. Frontend Setup

Navigate to the frontend directory:

```bash
cd booknook-client
```

Install dependencies:

```bash
npm install
```

Create a `.env.local` file:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

Configure the Better Auth environment variables and OAuth credentials required by your authentication setup.

Start the frontend:

```bash
npm run dev
```

Open the application:

```text
http://localhost:3000
```

---

## 🔗 API Endpoints

Base URL:

```text
http://localhost:8000
```

### General

| Method | Endpoint | Description | Access |
| --- | --- | --- | --- |
| GET | `/` | API welcome message | Public |
| GET | `/api/health` | API health check | Public |

### Books

| Method | Endpoint | Description | Access |
| --- | --- | --- | --- |
| GET | `/api/books` | Get books with search, filtering, sorting, and pagination | Public |
| GET | `/api/books/latest` | Get the latest 8 books | Public |
| GET | `/api/books/:id` | Get book details | Authenticated |
| POST | `/api/books` | Add a new book | Authenticated |
| PUT | `/api/books/:id` | Update an owned book | Authenticated |
| DELETE | `/api/books/:id` | Delete an owned book | Authenticated |
| GET | `/api/my-books` | Get books owned by the current user | Authenticated |

### Borrowings

| Method | Endpoint | Description | Access |
| --- | --- | --- | --- |
| POST | `/api/borrows` | Borrow a book | Authenticated |
| GET | `/api/borrows` | Get current user's borrowing records | Authenticated |
| PATCH | `/api/borrows/:id/return` | Return a borrowed book | Authenticated |

### Newsletter

| Method | Endpoint | Description | Access |
| --- | --- | --- | --- |
| POST | `/api/newsletter` | Subscribe to the newsletter | Public |

**Authentication:** Protected endpoints require a valid JWT in the request's `Authorization` header.

```http
Authorization: Bearer YOUR_JWT_TOKEN
```

---

## 📡 API Response Format

BookNook follows a consistent JSON response structure.

### Successful Response

```json
{
  "success": true,
  "message": "Book added successfully.",
  "data": {
    "_id": "book_id",
    "title": "The Alchemist"
  }
}
```

### Error Response

```json
{
  "success": false,
  "message": "Book not found."
}
```

Some validation errors may also include an `errors` array identifying invalid fields.

---

## ⚙️ Environment Variables

### Backend Environment Variables

| Variable | Description |
| --- | --- |
| `PORT` | Backend server port |
| `MONGODB_URI` | MongoDB connection string |
| `DB_NAME` | MongoDB database name |
| `BETTER_AUTH_URL` | Better Auth application URL |
| `CLIENT_URL` | Allowed frontend origin |

### Frontend Environment Variables

| Variable | Description |
| --- | --- |
| `NEXT_PUBLIC_API_URL` | Backend API base URL |
| Better Auth variables | Authentication secret, base URL, and configured OAuth credentials |

**Security Note:** Never commit `.env` or `.env.local` files, database credentials, authentication secrets, or private OAuth credentials to GitHub.

---

## 🛡️ Security & Validation

BookNook implements several security and data-integrity measures:

- JWT verification for protected API routes.
- Authenticated user identity derived from verified tokens.
- Ownership checks before editing or deleting books.
- Request body validation and normalization.
- Maximum field-length restrictions.
- MongoDB ObjectId validation.
- Prevention of duplicate active borrowings.
- Atomic updates for available book copies.
- Transaction-based borrowing and returning.
- Unique database indexes for critical records.
- CORS origin restrictions.
- Consistent error handling.

---

## 🌐 Deployment

The application is designed to support separate frontend and backend deployments.

Suggested deployment configuration:

| Component | Platform |
| --- | --- |
| Frontend | Vercel |
| Backend | Vercel or another Node.js hosting platform |
| Database | MongoDB Atlas |

For production deployment:

1. Configure production environment variables.
2. Add the deployed frontend origin to backend CORS settings.
3. Configure the production Better Auth URL and JWT verification.
4. Connect the backend to MongoDB Atlas.
5. Ensure the MongoDB deployment supports transactions.
6. Deploy the frontend and backend.
7. Test authentication, book management, borrowing, and returning.

---

## 📌 Future Improvements

Potential features for future development:

- Advanced book recommendation system.
- Book ratings and reviews.
- Reading lists and favorites.
- Notifications for approaching return dates.
- Overdue borrowing management.
- Admin dashboard and platform analytics.
- Advanced borrowing statistics.
- Book availability notifications.

---

## 👨‍💻 Author

<div align="center">

  <h2>✨ Md. Sofian Hasan ✨</h2>

  <p>
    <strong>Software Engineer | Full-Stack (MERN / PERN) Developer</strong>
  </p>

  <p align="center">

[![🌐 Portfolio](https://img.shields.io/badge/🌐_Portfolio-Visit_Website-0A0A0A?style=for-the-badge)](https://marleydip.netlify.app/)
&nbsp;
[![💻 GitHub](https://img.shields.io/badge/💻_GitHub-View_Profile-181717?style=for-the-badge&logo=github)](https://github.com/marleyDip)

</p>

</div>

<p align="center">
  Passionate about building <strong>modern, scalable, and user-focused web applications</strong> while continuously strengthening <b><i>JavaScript, TypeScript, problem-solving, and full-stack development skills</i></b>.
</p>

### 🚀 Tech Focus

<div align="center">

<img src="https://skillicons.dev/icons?i=js,ts,react,nextjs,tailwind,nodejs,express,nestjs,mongodb,postgres" alt="Tech Stack" />

<br /><br />

<img src="https://img.shields.io/badge/MERN-Stack-61DAFB?style=for-the-badge" alt="MERN Stack" />
<img src="https://img.shields.io/badge/PERN-Stack-336791?style=for-the-badge" alt="PERN Stack" />

</div>

---

## 📄 License

This project is developed for educational and learning purposes. You may adapt and extend it according to your requirements.

---

## 🙏 Acknowledgements & Learning Credits

### Special Thanks to Programming Hero

This project was developed as part of my learning journey through the **AI-Driven Full Stack Web Engineering Course Level-1 Batch-14**.

I would like to express my sincere gratitude to the entire **Programming Hero team, instructors, mentors, and community** for providing structured learning resources, practical guidance, and an encouraging environment to grow as a developer.

Throughout this journey, I have had the opportunity to strengthen my understanding of modern web development concepts, explore full-stack application architecture, and apply my knowledge by building real-world projects.

**BookNook represents more than just a course assignment — it is an opportunity to transform the concepts I have learned into a practical, functional application.**

Special thanks for inspiring me to keep learning, experimenting, solving problems, and building better software.

**Learning never stops. Every project is another step forward.** 🚀

<p align="center">
  <a href="https://codelab.programming-hero.com/u/marleydip">
    <img src="https://img.shields.io/badge/Programming%20Hero-Learning%20Partner-FF4B4B?style=for-the-badge" alt="Programming Hero" />
  </a>
</p>
