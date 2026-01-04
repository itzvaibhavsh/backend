import {asyncHandler} from "../utils/asyncHandler.js"
import {ApiError} from "../utils/ApiError.js"
import {User} from "../models/user.model.js"
import {uploadOnCloudinary} from "../utils/cloudinary.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import jwt from "jsonwebtoken"

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
    // get user details from frontend
    // validation - not empty
    // check if user already exists: username, email
    // check for images, check for avatar
    // create user object - create entry in db
    // remove password and refresh token field from response
    // check for user creation
    // return res
    const {fullName, email, username, password} = req.body  // json ya form se data aae wo bhi body me milta hai

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

      if(!username && !email){
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
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", refreshToken, options)
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
            $unset: {
                refreshToken: 1 // 1 acts as flag
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

const refreshAccessToken = asyncHandler( async(req, res) => {
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken

    if(!incomingRefreshToken) {
        throw new ApiError(401, "unauthorized request")
    }

    try{
        const decodedToken = jwt.verify(
        incomingRefreshToken,
        process.env.REFRESH_TOKEN_SECRET
    )

    const user = await User.findById(decodedToken?._id)

    if(!user) {
        throw new ApiError(401, "Invalid refresh token")
    }

    if(incomingRefreshToken !== user?.refreshToken) {
         throw new ApiError(401, "Refresh token is expired or used")
    }

    const options = {
        httpOnly: true,
        secure: true
    }

    const {accessToken, newRefreshToken} = await generateAccessAndRefreshTokens(user._id)

    return res
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", newRefreshToken, options)
    .json(
        new ApiResponse(
            200,
            {accessToken, refreshToken: newRefreshToken},
            "Access token refreshed"
        )
    )
    } catch(error) {
        throw new ApiError(401, error?.message || "Invalid refresh token")
    }


    
})

const changeCurrentPassword = asyncHandler(async(req,res) => {
    const {oldPassword, newPassword} = req.body

    const user = await User.findById(req.user?._id)
    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword)
    if(!isPasswordCorrect) {
        throw new ApiError(400, "Invalid old password")
    }

    user.password = newPassword
    await user.save({validateBeforeSave: false})

    return res
    .status(200)
    .json(new ApiResponse(200, {}, "Password changed successfully"))

})

const getCurrentUser = asyncHandler(async(req, res) => {
    return res
    .status(200)
    .json(new ApiResponse(
        200, 
        req.user, 
        "user fetched successfully"
    ))
})

// if file update is needed use another controller or endpoint so that text change in database doesn't happen in that case
const updateAccountDetails = asyncHandler(async(req, res) => {
    const {fullName, email} = req.body

    if(!fullName || !email) {
        throw new ApiError(400, "All fields are required")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                fullName,
                email: email
            }
        },
        {new: true}  // this returns the updated values
    ).select("-password")

    return res
    .status(200)
    .json(new ApiResponse(200, user, "Account details updated successfully"))
})

// 2 middlewares required, multer for uploading and verifyJWT for authorization check
const updateUserAvatar = asyncHandler(async(req, res) => {
    const avatarLocalPath = req.file?.path
    if(!avatarLocalPath) {
        throw new ApiError(400, "Avatar file is missing")
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath)

    if(!avatar.url) {
        throw new ApiError(400, "Error while uploading on avatar")
    }

    const user = await findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                avatar: avatar.url
            }
        },
        {new: true}
    ).select("-password")

    return res
    .status(200)
    .json(
        new ApiResponse(200, user, "Avatar image updated successfully")
    )
})

const updateUserCoverImage = asyncHandler(async(req, res) => {
    const coverImageLocalPath = req.file?.path
    if(!coverImageLocalPath) {
        throw new ApiError(400, "Cover image file is missing")
    }

    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if(!coverImage.url) {
        throw new ApiError(400, "Error while uploading on coverImage")
    }

    const user = await findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                coverImage: coverImage.url
            }
        },
        {new: true}
    ).select("-password")

    return res
    .status(200)
    .json(
        new ApiResponse(200, user, "Cover image updated successfully")
    )
})


export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountDetails,
    updateUserAvatar,
    updateUserCoverImage
}