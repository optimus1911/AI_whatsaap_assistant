// Reusable centralized global Express error handler
const errorHandler = (err, req, res, next) => {
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode
  
  console.error(`[Error Boundary]: ${err.message}`)
  if (err.stack && process.env.NODE_ENV === 'development') {
    console.error(err.stack)
  }

  res.status(statusCode).json({
    success: false,
    message: err.message || 'Internal Server Error',
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  })
}

export default errorHandler
