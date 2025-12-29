import express from "express"
import cors from "cors"
import cookieParser from "cookie-parser"

const app = express()

app.use(cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true
}))

app.use(express.json({limit: "16kb"})) // configuration to tell that we accept json
app.use(express.urlencoded({extended: true, limit: "16kb"}))  // configuration to understand the data encoded in url
app.use(express.static("public"))  // configration to tell that I will accept images or files and in which folder
app.use(cookieParser())  // to make server accessible to secure cookies from browser

//routes import
import userRouter from "./routes/user.routes.js"

//routes declaration
app.use("/api/v1/users", userRouter) // if this url hits, we give the control to userRouter.
// previously we did app.get() and wrote both route and controller inside, but here we are importing both, so we need to use middleware

export {app}