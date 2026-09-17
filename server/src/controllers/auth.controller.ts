import { Profile } from "passport-google-oauth20";
import jwt from "jsonwebtoken";
import mongoose, { ObjectId } from "mongoose";
import { IUser, User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  FRONTEND_URL,
  REFRESH_TOKEN_SECRET,
} from "../config/config.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { Room } from "../models/room.model.js";

const generateAccessAndRefreshToken = async (
  userId: ObjectId
): Promise<{ accessToken: string; refreshToken: string }> => {
  try {
    const user = await User.findById(userId);

    if (!user) {
      throw new Error("User not found");
    }

    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    user.refreshToken = refreshToken;
    user.save({ validateBeforeSave: false });

    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(
      500,
      "Something went wrong while generating refresh and access token"
    );
  }
};

const refreshAccessToken = asyncHandler(async (req, res) => {
  const incomingRequestToken =
    req.cookies.refreshToken || req.body.refreshToken;

  if (!incomingRequestToken) {
    throw new ApiError(401, "Unauthorized request");
  }

  try {
    const decodedToken = jwt.verify(
      String(incomingRequestToken),
      REFRESH_TOKEN_SECRET!
    );

    const user = await User.findById((decodedToken as jwt.JwtPayload)._id);

    if (!user) {
      throw new ApiError(401, "Invalid refresh token");
    }

    const options = {
      httpOnly: true,
      secure: true,

      sameSite: "none" as const,
    };

    const { accessToken, refreshToken } = await generateAccessAndRefreshToken(
      user._id
    );

    return res
      .status(200)
      .clearCookie("refreshToken", options)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", refreshToken, options)
      .json(
        new ApiResponse(
          200,
          { accessToken, refreshToken },
          "Access token refreshed"
        )
      );
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new ApiError(401, "Refresh token expired, please login again");
    } else if (error instanceof jwt.JsonWebTokenError) {
      throw new ApiError(401, "Invalid refresh token, please login again");
    } else {
      throw new ApiError(500, "Something went wrong while refreshing token");
    }
  }
});

const handleGoogleLogin = asyncHandler(async (req, res) => {
  const { id: googleId } = req.user as Profile;
  const user = await User.findOne({ googleId }).select("-refreshToken");

  if (!user) {
    throw new ApiError(401, "Authentication failed");
  }

  const { accessToken, refreshToken } = await generateAccessAndRefreshToken(
    user._id
  );

  const isProduction = process.env.NODE_ENV === "production";

  const options = {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? ("none" as const) : ("lax" as const),

    maxAge: 7 * 24 * 60 * 60 * 1000,
  };

  res.cookie("accessToken", accessToken, options);
  res.cookie("refreshToken", refreshToken, options);

  return res.redirect(`${FRONTEND_URL}/room`);
});

const handleGoogleLogout = asyncHandler(async (req, res, next) => {
  try {
    const { _id: userId } = req.user as IUser;

    if (!mongoose.isValidObjectId(userId)) {
      throw new ApiError(400, "Invalid user ID");
    }

    await Room.deleteMany({ owner: userId }).catch((err) => {
      console.error("Error deleting rooms:", err);
      throw new ApiError(500, "Error deleting rooms");
    });

    res.clearCookie("accessToken", {
      httpOnly: true,
      secure: true,
      sameSite: "none",
    });
    res.clearCookie("refreshToken", {
      httpOnly: true,
      secure: true,
      sameSite: "none",
    });

    return res
      .status(200)
      .json(new ApiResponse(200, {}, "Logged out successfully"));
  } catch (error) {
    console.error("Logout Error:", error);
    next(new ApiError(500, "Internal Server Error"));
  }
});

const getUserInfo = asyncHandler(async (req, res) => {
  const { _id: userId } = req.user as IUser;

  if (!mongoose.isValidObjectId(userId)) {
    throw new ApiError(400, "Invalid user Id");
  }

  const user = await User.findById(userId).select(
    "-refreshToken -createdAt -updatedAt -__v -temporarilyDisconnected -disconnectedAt"
  );

  if (!user) {
    throw new ApiError(401, "User not found");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, user, "User info fetched successfully"));
});

export {
  handleGoogleLogin,
  handleGoogleLogout,
  getUserInfo,
  refreshAccessToken,
};
