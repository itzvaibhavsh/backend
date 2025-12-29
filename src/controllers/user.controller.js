import {asyncHandler} from "../utils/asyncHandler.js"
import {ApiError} from "../utils/ApiError.js"
import {User} from "../models/user.model.js"
import {uploadOnCloudinary} from "../utils/cloudinary.js"
import {ApiResponse} from "../utils/ApiResponse.js"

const registerUser = asyncHandler( async (req, res) => {
    // get user details from frontend
    // validation - not empty
    // check if user already exists: username, email
    // check for images, check for avatar
    // create user object - create entry in db
    // remove password and refresh token field from response
    // check for user creation
    // return res

    const {fullName, email, username, password} = req.body  // json ya form se data aae wo bhi body me milta hai
    console.log("email: ", email);

    if(
        [fullName, email, username, password].some((field) => field?.trim() === "")
    ) {
        throw new ApiError(400, "All fields are necessary")
    }
    
    /// we made this User through mongoose, so it has capability to talk directly with mongoDB
    const existedUser = User.findOne({
        $or: [{username}, {email}]
    })
    if(existedUser) {
        throw new ApiError(409, "User with email or username already exists")
    }

    // multer middleware add more fields in request
    const avatarLocalPath = req.files?.avatar[0].path;
    const converImageLocalPath = req.files?.coverImage[0].path;
    
    if(!avatarLocalPath) {
        throw new ApiError(400, "Avatar file is required")
    }
    
    // sometimes we intentionally want user to wait until our work is done. we have used asyncHandler which returns a promise but
    // here we have to wait and keep user told that we are doing this activity
    const avatar = await uploadOnCloudinary(avatarLocalPath)
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)
    if(!avatar) {
        throw new ApiError(400, "Avatar file is required")
    }

    const user = await User.create({
        fullName,
        avatar: avatar.url,
        coverImage: coverImage?.url,
        email,
        password,
        username: username.toLowerCase()
    })

    // mongoDB attaches an id with every entry. createdUser contains response
    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )

    if(!createdUser) {
        throw new ApiError(500, "Something went wrong while registering the user")
    }

    return res.status(201).json(
        new ApiResponse(200, createdUser, "User registered successfully")
    )

})


export {registerUser}