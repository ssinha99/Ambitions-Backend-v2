const jwt = require('jsonwebtoken')
module.exports = (req, res, next) => {
    try{
        const token = req.headers.authorization?.split(" ")[1];  // Authorization : Bearer token
        if(!token){
            throw new Error('token not found!')
        }
        const decodedToken = jwt.verify(token, 'secretKey')
        req.userData = {email: decodedToken.email}
        next()
    }
    catch(error){
        return next(error);
    }
};