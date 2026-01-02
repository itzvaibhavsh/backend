import {asyncHandler} from "../utils/asyncHandler.js"
import {ApiError} from "../utils/ApiError.js"
import {User} from "../models/user.model.js"
import {uploadOnCloudinary} from "../utils/cloudinary.js"
import {ApiResponse} from "../utils/ApiResponse.js"

const generateAccessAndRefreshTokens = async(userId) => {
    try {
         const user = await User.findById(userId)
         const accessToken = user.generateAccessToken()
         const refreshToken = user.generateRefreshToken()

         user.refreshToken = refreshToken
         await user.save({ validateBeforeSave: false }) // used validateBeforeSave as there are fields like password, email etc which
         // are required for saving

         return {accessToken, refreshToken}

    } catch(error) {
        throw new ApiError(500, "Something went wrong while generating refresh and access token")
    }
}

const registerUser = asyncHandler( async (req, res) => {
    console.log("BODY =>", req.body);
    // get user details from frontend
    // validation - not empty
    // check if user already exists: username, email
    // check for images, check for avatar
    // create user object - create entry in db
    // remove password and refresh token field from response
    // check for user creation
    // return res
    const {fullName, email, username, password} = req.body  // json ya form se data aae wo bhi body me milta hai
    // console.log("email: ", email);

    if(
        [fullName, email, username, password].some((field) => field?.trim() === "")
    ) {
        throw new ApiError(400, "All fields are necessary")
    }
    
    /// we made this User through mongoose, so it has capability to talk directly with mongoDB
    const existedUser = await User.findOne({
        $or: [{username}, {email}]
    })
    if(existedUser) {
        throw new ApiError(409, "User with email or username already exists")
    }

    // multer middleware add more fields in request

    const avatarLocalPath = req.files?.avatar[0].path;
    // const coverImageLocalPath = req.files?.coverImage[0].path;
    let coverImageLocalPath;
    if(req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0) {
        coverImageLocalPath = req.files.coverImage[0].path
    }
    
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
        coverImage: coverImage?.url || "",
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

const loginUser = asyncHandler( async (req, res) => {
      // req body -> data
      // username or email
      // find the user
      // password check
      // access and refresh token
      // send cookie

      const {username, email, password} = req.body

      if(!username || !email){
          throw new ApiError(400, "username or email is required")
      }

      const user = await User.findOne({
        $or: [{username}, {email}]
      })

      if(!user) {
        throw new ApiError(404, "User does not exist")
      }      

      const isPasswordValid = await user.isPasswordCorrect(password)

      if(!isPasswordValid) {
        throw new ApiError(401, "Invalid user credentials")
      }

      const {accessToken, refreshToken} = await generateAccessAndRefreshTokens(user._id)

      const loggedInUser = await User.findById(user._id).select("-password -refreshToken")

      // this will make the cookie unmodifiable by frontend, only by server
      const options = {
        httpOnly: true,
        secure: true
      }

      return res
      .status(200)
      .cookie("accessToken", accessToken)
      .cookie("refreshToken", refreshToken)
      .json(
        new ApiResponse(
            200,
        {
            user: loggedInUser, accessToken, refreshToken   // sending both tokens again, in case user wants to save them
        },
        "User logged in successfully"
        )
      )

})

// we will reach logouUser, when auth middleware has already been hit
const logoutUser = asyncHandler( async(req, res) => {
      await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {
                refreshToken: undefined
            }
        },
        {
            new: true
        }
      )

      const options = {
        httpOnly: true,
        secure: true
      }

      return res
      .status(200)
      .clearCookie("accessToken", options)
      .clearCookie("refreshToken", options)
      .json(new ApiResponse(200, {}, "User logged out"))
})


export {
    registerUser,
    loginUser,
    logoutUser
}