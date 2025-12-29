import {Router} from "express";
import {registerUser} from "../controllers/user.controller.js"
import {upload} from "../middlewares/multer.middleware.js"
 
const router = Router()

router.route("/register").post(
    // we are injecting middleware here. As soon as we hit this url this middleware will execute, then the method registerUser
    upload.fields([
        {
            name: "avatar",
            maxCount: 1
        }, 
        {
            name: "coverImage",
            maxCount: 1
        }
    ]),
    registerUser
)

export default router