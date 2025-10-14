// server.js (PostgreSQL Full Backend Migration)

import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
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

const app = express();
const port = process.env.PORT || 5000;
app.use(express.json());
app.use(cors());

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
  const result = await pool.query("SELECT * FROM booksinfo ORDER BY location");
  res.json(result.rows);
});

app.get("/userList", async (req, res) => {
  const result = await pool.query("SELECT * FROM persons");
  res.json(result.rows);
});

app.post("/addbook", async (req, res) => {
  const { bookid, title, author, yearofpublish, location, department, publisher, language, status, appliedby, description,imageurl } = req.body;
  await pool.query(`INSERT INTO booksinfo (bookid, title, author, yearofpublish, department, location, language, publisher, description, status, appliedby, imageurl) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
    [bookid, title, author, yearofpublish, department, location, language, publisher, description, status, appliedby, imageurl]);
  res.send("Inserted successfully");
});

app.delete("/deleteBook/:id", async (req, res) => {
  const { id } = req.params;
  await pool.query("DELETE FROM booksinfo WHERE bookid=$1", [id]);
  res.send("Deleted successfully");
});

app.get("/bookDetails/:bookid", async (req, res) => {
  const { bookid } = req.params;
  const result = await pool.query("SELECT * FROM booksinfo WHERE bookid=$1", [bookid]);
  res.json(result.rows[0]);
});

app.get("/studentDetails/:email", async (req, res) => {
  const { email } = req.params;
  const result = await pool.query("SELECT * FROM persons WHERE email=$1", [email]);
  res.json(result.rows[0]);
});

app.put("/updateBook/:bookid", async (req, res) => {
  const { bookid } = req.params;
  const { title, description, author, yearofpublish, location, department, publisher, language, imageurl } = req.body;
  await pool.query(`UPDATE booksinfo SET title=$1, description=$2, author=$3, yearofpublish=$4, department=$5, location=$6, language=$7, publisher=$8, imageurl=$9 WHERE bookid=$10`,
    [title, description, author, yearofpublish, department, location, language, publisher, imageurl, bookid]);
  res.send("Updated successfully");
});

app.put("/updateBookStatus/:bookid", authenticationToken, async (req, res) => {
  const { bookid } = req.params;
  const { status, appliedby } = req.body;
  const appliedbyText = appliedby === "email" ? req.email : appliedby;
  await pool.query("UPDATE booksinfo SET status=$1, appliedby=$2 WHERE bookid=$3", [status, appliedbyText, bookid]);
  res.send("Updated successfully");
});

app.post("/register", async (req, res) => {
  const { email, name, password, mobile, age, qualification, address, role, gender, status,photo } = req.body;
  const user = await pool.query("SELECT * FROM persons WHERE email=$1", [email]);
  if (user.rows.length) return res.status(500).send({ text: "Email Already Exist" });
  const hashedPassword = await bcrypt.hash(password, 17);
  await pool.query(`INSERT INTO persons (role, email, name, password, mobile, age, qualification, address, gender, status, photo) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [role, email, name, hashedPassword, mobile, age, qualification, address, gender, status, photo]);
  res.send({ text: "Registration Successful" });
});

app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  const user = await pool.query("SELECT * FROM persons WHERE email=$1", [email]);
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
  await pool.query("UPDATE persons SET status=$1 WHERE email=$2", [statusText, email]);
  res.send("Updated successfully");
});

app.get("/studentUtilities/appliedBooks", authenticationToken, async (req, res) => {
  const result = await pool.query("SELECT * FROM booksinfo WHERE appliedby=$1", [req.email]);
  res.json(result.rows);
});

app.get("/userDetails", authenticationToken, async (req, res) => {
  const result = await pool.query("SELECT * FROM persons WHERE email=$1", [req.email]);
  res.json(result.rows);
});

app.put("/updateUserDetails", async (req, res) => {
  const { email, name, mobile, age, qualification, address, gender, photo } = req.body;
  await pool.query(`UPDATE persons SET name=$1, age=$2, address=$3, mobile=$4, qualification=$5, gender=$6, photo=$7 WHERE email=$8`,
    [name, age, address, mobile, qualification, gender, photo, email]);
  res.send("Updated successfully");
});

app.delete("/deleteUser/:email", async (req, res) => {
  const { email } = req.params;
  await pool.query("DELETE FROM persons WHERE email=$1", [email]);
  res.send("Deleted successfully");
});

app.get("/getEmail", authenticationToken, async (req, res) => {
  res.send({ email: req.email });
});

app.put("/updateRating/:bookid", authenticationToken, async (req, res) => {
  const {bookid}=req.params;
  const {rating,feedback}=req.body;
  const result = await pool.query("SELECT ratings FROM booksinfo WHERE bookid=$1", [bookid]);
  const currentRatings = result.rows[0].ratings || [];
  if (typeof currentRatings === 'string') {
    currentRatings = JSON.parse(currentRatings);
  }
  const newRating = {
    rating: rating,
    feedback: feedback,
    ratedby: req.email
  };
  if (currentRatings.some(r => r.ratedby === req.email)) {
  return res.status(400).send({text:"You have already rated this book"});
  }
  const updatedRatings = [...currentRatings, newRating];
  await pool.query(`UPDATE booksinfo SET ratings=$1 WHERE bookid=$2`,[JSON.stringify(updatedRatings),bookid]);
  res.send({text:"submitted successfully"});
});


app.listen(port, () => console.log(`Server running on port ${port}`));
