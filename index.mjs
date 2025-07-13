// server.js (PostgreSQL Full Backend Migration)

import express from 'express';
import cors from 'cors';
import multer from 'multer';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import pkg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const port = process.env.PORT || 5000;
app.use(express.json());
app.use(cors());
app.use('/uploads', express.static('uploads'));

// Multer Configs
// JWT Middleware
const authenticationToken = (req, res, next) => {
  const authHeader = req.headers["authentication"];
  const token = authHeader?.split(" ")[1];
  if (!token) return res.status(401).send("Unauthorized User");

  jwt.verify(token, "ajay", (err, payload) => {
    if (err) return res.status(401).send("Unauthorized User");
    req.email = payload.email;
    next();
  });
};

// Routes

app.get("/booksList", async (req, res) => {
  const result = await pool.query("SELECT * FROM booksInfo ORDER BY location");
  res.json(result.rows);
});

app.get("/userList", async (req, res) => {
  const result = await pool.query("SELECT * FROM Persons");
  res.json(result.rows);
});

app.post("/addbook", async (req, res) => {
  const { bookId, title, author, yearOfPublish, location, department, publisher, language, status, appliedBy, description,imageUrl } = req.body;
  await pool.query(`INSERT INTO booksInfo (bookId, title, author, yearOfPublish, department, location, language, publisher, description, status, appliedBy, imageUrl) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
    [bookId, title, author, yearOfPublish, department, location, language, publisher, description, status, appliedBy, imageUrl]);
  res.send("Inserted successfully");
});

app.delete("/deleteBook/:id", async (req, res) => {
  const { id } = req.params;
  await pool.query("DELETE FROM booksInfo WHERE bookId=$1", [id]);
  res.send("Deleted successfully");
});

app.get("/bookDetails/:bookId", async (req, res) => {
  const { bookId } = req.params;
  const result = await pool.query("SELECT * FROM booksInfo WHERE bookId=$1", [bookId]);
  res.json(result.rows[0]);
});

app.get("/studentDetails/:email", async (req, res) => {
  const { email } = req.params;
  const result = await pool.query("SELECT * FROM Persons WHERE email=$1", [email]);
  res.json(result.rows[0]);
});

app.put("/updateBook/:bookId", async (req, res) => {
  const { bookId } = req.params;
  const { title, description, author, yearOfPublish, location, department, publisher, language, imageUrl } = req.body;
  await pool.query(`UPDATE booksInfo SET title=$1, description=$2, author=$3, yearOfPublish=$4, department=$5, location=$6, language=$7, publisher=$8, imageUrl=$9 WHERE bookId=$10`,
    [title, description, author, yearOfPublish, department, location, language, publisher, imageUrl, bookId]);
  res.send("Updated successfully");
});

app.put("/updateBookStatus/:bookId", authenticationToken, async (req, res) => {
  const { bookId } = req.params;
  const { status, appliedBy } = req.body;
  const appliedByText = appliedBy === "email" ? req.email : appliedBy;
  await pool.query("UPDATE booksInfo SET status=$1, appliedBy=$2 WHERE bookId=$3", [status, appliedByText, bookId]);
  res.send("Updated successfully");
});

app.post("/register", async (req, res) => {
  const { email, name, password, mobile, age, qualification, address, role, gender, status,photo } = req.body;
  const user = await pool.query("SELECT * FROM Persons WHERE email=$1", [email]);
  if (user.rows.length) return res.status(500).send({ text: "Email Already Exist" });
  const hashedPassword = await bcrypt.hash(password, 17);
  await pool.query(`INSERT INTO Persons (role, email, name, password, mobile, age, qualification, address, gender, status, photo) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [role, email, name, hashedPassword, mobile, age, qualification, address, gender, status, photo]);
  res.send({ text: "Registration Successful" });
});

app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  const user = await pool.query("SELECT * FROM Persons WHERE email=$1", [email]);
  const dbUser = user.rows[0];
  if (!dbUser) return res.status(400).send({ text: "User not Exist" });
  if (dbUser.status === 'blocked') return res.status(400).send({ text: "User is Blocked please contact admin!" });
  const isMatch = await bcrypt.compare(password, dbUser.password);
  if (!isMatch) return res.status(400).send({ text: "email or password is incorrect" });
  const token = jwt.sign({ email }, "ajay");
  res.send({ jwtToken: token, role: dbUser.role });
});

app.put("/updateUserStatus", async (req, res) => {
  const { statusText, email } = req.body;
  await pool.query("UPDATE Persons SET status=$1 WHERE email=$2", [statusText, email]);
  res.send("Updated successfully");
});

app.get("/studentUtilities/appliedBooks", authenticationToken, async (req, res) => {
  const result = await pool.query("SELECT * FROM booksInfo WHERE appliedBy=$1", [req.email]);
  res.json(result.rows);
});

app.get("/userDetails", authenticationToken, async (req, res) => {
  const result = await pool.query("SELECT * FROM Persons WHERE email=$1", [req.email]);
  res.json(result.rows);
});

app.put("/updateUserDetails", async (req, res) => {
  const { email, name, mobile, age, qualification, address, gender, photo } = req.body;
  await pool.query(`UPDATE Persons SET name=$1, age=$2, address=$3, mobile=$4, qualification=$5, gender=$6, photo=$7 WHERE email=$8`,
    [name, age, address, mobile, qualification, gender, photo, email]);
  res.send("Updated successfully");
});

app.delete("/deleteUser/:email", async (req, res) => {
  const { email } = req.params;
  await pool.query("DELETE FROM Persons WHERE email=$1", [email]);
  res.send("Deleted successfully");
});

app.get("/getEmail", authenticationToken, async (req, res) => {
  res.send({ email: req.email });
});

app.listen(port, () => console.log(`Server running on port ${port}`));
