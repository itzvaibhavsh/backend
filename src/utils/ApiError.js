class ApiError extends Error {
    constructor(
        statusCode,
        message= "Something went wrong",
        errors = [],
        stack = ""
    ){
        super(message)
        this.statusCode = statusCode
        this.data = null
        this.message = message
        this.success = false;
        this.errors = errors

        if(stack) {
             this.stack = stack
        } else  {
            Error.captureStackTrace(this, this.constructor)    // we passes the instance of the context to the Stack Trace
        }
    }
}

export {ApiError}