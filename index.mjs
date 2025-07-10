import express from 'express';
import {open} from 'sqlite';
import sqlite3 from 'sqlite3';
import cors from 'cors';
import multer from 'multer';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const app=express();
const port = process.env.PORT || 5000;
app.use(express.json());
app.use(cors());
app.use('/uploads',express.static('uploads'));
sqlite3.verbose();
let db=null;
const initalizeDbServer=async()=>{
    try{
        db=await open({
            filename:"./libraryserver.db",
            driver:sqlite3.Database
        });
        app.listen(port, () => {
        console.log(`Server started on port ${port}`);
});
    }
    catch(e){
        console.log(`error:${e.message}`);
        process.exit(1);
    }
};
initalizeDbServer();

const bookimgstorage=multer.diskStorage({
    destination:"uploads/books/",
    filename:(request,file,cb)=>{
        cb(null,Date.now()+'-'+file.originalname)
    }
})
const personimgstorage=multer.diskStorage({
    destination:"uploads/persons/",
    filename:(request,file,cb)=>{
        cb(null,Date.now()+'-'+file.originalname)
    }
})

const uploadBookFile=multer({
    storage:bookimgstorage
});

const uploadPersonFile=multer({
    storage:personimgstorage
});


//-----------------MiddleWare authentication starts--------

const authenticationToken=(request,response,next)=>{
    let jwtToken;
    const tokenHeader=request.headers["authentication"];
    if(tokenHeader!==undefined){
        jwtToken=tokenHeader.split(" ")[1];
    }
    if(jwtToken===undefined){
        response.status(401);
        response.send("UnAuthurized User");
    }else{
        jwt.verify(jwtToken,"ajay",async(error,payload)=>{
            if(error){
                response.status(401);
                response.send("Unauthurized User");
            }else{
                request.email=payload.email;
                next();
            }
        });
    }
};

//-----------------MiddleWare authentication starts--------


//--------------get booksList api starts-----------


    app.get("/booksList",async(request,response)=>{
        const query1=`
        SELECT * FROM booksInfo ORDER BY location;
    `;
    const result=await db.all(query1);
        response.send(result);
    });

//--------------get booksList api ends-----------


//--------------get userList api starts-----------


    app.get("/userList",async(request,response)=>{
        const query1=`
        SELECT * FROM Persons;
    `;
    const result=await db.all(query1);
        response.send(result);
    });

//--------------get userList api ends-----------



//--------------add book api starts-----------

    app.post("/addBook",uploadBookFile.single('imageUrl'),async(request,response)=>{
        console.log(request.body);
    const {bookId,title,description,author,yearOfPublish,location,department,publisher,language,status,appliedBy}=request.body;
    const photoPath = request.file ? request.file.filename : null;
    const query2=`INSERT 
    INTO 
    booksInfo (bookId,title,author,yearOfPublish,department,location,language,publisher,description,status,appliedBy,imageUrl) 
    VALUES 
    ('${bookId}', '${title}', '${author}',${yearOfPublish},'${department}','${location}','${language}','${publisher}','${description}','${status}','${appliedBy}','${photoPath}');`;
    const result2=await db.run(query2);
    response.send("inserted successfully");
});

//--------------add book api ends-----------



//--------------delete book api starts-----------


app.delete("/deleteBook/:id",async(request,response)=>{
    const {id}=request.params;
    const imageGetQuery=await db.get(`SELECT imageUrl FROM BooksInfo WHERE bookId='${id}'`);
    const filePath=path.join(__dirname,'uploads','books',`${imageGetQuery.imageUrl}`)
    fs.unlinkSync(filePath);
    const deleteQuery=`DELETE FROM booksInfo WHERE bookId='${id}';`;
    const result=await db.run(deleteQuery);
    response.send("delete successfully");
});


//--------------delete book api ends-----------


//--------------get single book api starts-----------


app.get("/bookDetails/:bookId",async(request,response)=>{
    const {bookId}=request.params;
    const getQuery=`SELECT * FROM booksInfo WHERE bookId='${bookId}';`;
    const result=await db.get(getQuery);
    response.send(result);
});


//--------------get single book api ends-----------



//--------------get single user api starts-----------


app.get("/studentDetails/:email",async(request,response)=>{
    const {email}=request.params;
    const getQuery=`SELECT * FROM Persons WHERE email='${email}';`;
    const result=await db.get(getQuery);
    response.send(result);
});


//--------------get single user api ends-----------



//---------------update Book api starts-------------



app.put("/updateBook/:bookId",uploadBookFile.single('imageUrl'),async(request,response)=>{
    const {bookId}=request.params;
    const {title,description,author,yearOfPublish,location,department,publisher,language,imageUrl}=request.body;
    let photoPath;
    if(request.file){
        try {
            const imageGetQuery=await db.get(`SELECT imageUrl FROM BooksInfo WHERE bookId='${bookId}'`);
            const filePath=path.join(__dirname,'uploads','books',`${imageGetQuery.imageUrl}`)
            fs.unlinkSync(filePath);
        } catch (error) {
            
        }
        photoPath=request.file.filename;
    }else{
        photoPath=imageUrl;
    }
    console.log(request.file);
    const query2=`UPDATE booksInfo SET
    title='${title}',
    description='${description}',
    author='${author}',
    yearOfPublish=${yearOfPublish},
    department='${department}',
    location='${location}',
    language='${language}',
    publisher='${publisher}',
    imageUrl='${photoPath}'
     WHERE bookId = '${bookId}';`;
    const result2=await db.run(query2);
    response.send("updated successfully");
});
//---------------update Book api ends-------------


//---------------update book status starts---------

app.put('/updateBookStatus/:bookId',authenticationToken,async(request,response)=>{
    const {bookId}=request.params;
    const {status,appliedBy}=request.body;
    const appliedByText=(appliedBy==="email")?request.email:appliedBy;
    const updateQuery=`UPDATE booksInfo SET status='${status}',appliedBy='${appliedByText}' WHERE bookId='${bookId}';`;
    const result= await db.run(updateQuery);
    response.send("updated successfully");
});


//---------------update book status ends---------


//--------------Register api starts-----------

    app.post("/register",uploadPersonFile.single('photo'),async(request,response)=>{
    const {email,name,password,mobile,age,qualification,address,role,gender,status}=request.body;
    const isExistUser =await db.get(`SELECT * FROM Persons WHERE email='${email}'`);
    if(isExistUser!==undefined){
        response.status(500);
        response.send({text:"Email Already Exist"})
    }else{
        const photoPath = request.file ? request.file.filename : null;
        const hashedPassword = await bcrypt.hash(password, 17);
        const query2=`INSERT 
        INTO 
        Persons (role,email,name,password,mobile,age,qualification,address,gender,status,photo) 
        VALUES 
        ('${role}','${email}', '${name}', '${hashedPassword}',${mobile},${age},'${qualification}','${address}','${gender}','${status}','${photoPath}');`;
        const result2=await db.run(query2);
        response.send({text:"Registration Successful"});
    }
});

//--------------Register api ends-----------


//---------------login api starts---------

app.post('/login',async(request,response)=>{
    const {email,password}=request.body;
    const dbUser=await db.get(`SELECT * FROM Persons WHERE email='${email}'`);
    const role=dbUser.role;
    if(dbUser===undefined){
        response.status(400);
        response.send({text:"User not Exist"})
    }else if(dbUser.status==='blocked'){
        response.status(400);
        response.send({text:"User is Blocked please contact admin!"})
    }
    else{
        const isPasswordMatch=await bcrypt.compare(password,dbUser.password);
        if(isPasswordMatch){
            const payload={
                email:email
            }
            const jwtToken=jwt.sign(payload,'ajay');
            response.send({jwtToken,role});
        }else{
            response.status(400);
            response.send({text:'email or password is incorrect'});
        }
    }

});


//---------------login api ends---------

//---------------update user status starts---------

app.put('/updateUserStatus',async(request,response)=>{
    const {statusText,email}=request.body;
    const updateQuery=`UPDATE Persons SET status='${statusText}' WHERE email='${email}';`;
    const result= await db.run(updateQuery);
    response.send("updated successfully");
});


//---------------update user status ends---------


//--------------get student Applied Books api starts-----------


app.get("/studentUtilities/appliedBooks",authenticationToken,async(request,response)=>{
    const email=request.email;
    const getQuery=`SELECT * FROM BooksInfo WHERE appliedBy='${email}';`;
    const result=await db.all(getQuery);
    response.send(result);
});


//--------------get student Applied Books api ends-----------


//--------------get user details api starts-----------


app.get("/userDetails",authenticationToken,async(request,response)=>{
    const email=request.email;
    const getQuery=`SELECT * FROM Persons WHERE email='${email}';`;
    const result=await db.all(getQuery);
    response.send(result);
});


//--------------get user details api ends-----------


// --------------Edit Profile api starts------------


    app.put("/updateUserDetails",uploadPersonFile.single('photo'),async(request,response)=>{
    const {email,name,mobile,age,qualification,address,gender,photo}=request.body;
    let photoPath;
    if(request.file){
        try{
            const imageGetQuery=await db.get(`SELECT photo FROM Persons WHERE email='${email}'`);
            const filePath=path.join(__dirname,'uploads','persons',`${imageGetQuery.photo}`)
            fs.unlinkSync(filePath);
        }
        catch(e){
           
        }
        
        photoPath=request.file.filename;
    }else{
        photoPath=photo;
    }
    const updateQuery=`UPDATE Persons SET name='${name}',age=${age},address='${address}',mobile=${mobile},qualification='${qualification}',gender='${gender}',photo='${photoPath}' WHERE email='${email}';`;
    const result2=await db.run(updateQuery);
    response.send("updated successfully");
});

// --------------Edit Profile api starts------------



//--------------delete book api starts-----------


app.delete("/deleteUser/:email",async(request,response)=>{
    const {email}=request.params;
    const imageGetQuery=await db.get(`SELECT photo FROM Persons WHERE email='${email}'`);
    const filePath=path.join(__dirname,'uploads','persons',`${imageGetQuery.photo}`)
    fs.unlinkSync(filePath);
    const deleteQuery=`DELETE FROM Persons WHERE email='${email}';`;
    const result=await db.run(deleteQuery);
    response.send("delete successfully");
});


//--------------delete book api ends-----------

app.get('/getEmail',authenticationToken,async(request,response)=>{
    const email=request.email;
    response.send({email});
});