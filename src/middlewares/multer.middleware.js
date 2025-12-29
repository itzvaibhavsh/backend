import multer from "multer";

const storage = multer.diskStorage({
    // req ke andar body and json data hoga
    // file ke andar actually hamari file hogi
  destination: function (req, file, cb) {
    cb(null, './public/temp')
  },
  filename: function (req, file, cb) {
    
    cb(null, file.originalname)
  }
})

export const upload = multer({ 
    storage,
 })