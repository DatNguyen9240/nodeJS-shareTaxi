const express = require('express');
const router = express.Router();
const {
    login,
    signup,
    google,
    getProfile,
    forgotPassword,
    resetPassword,
    getLocations,
    getAreas,
    findTrip,
    createTrip,
    cancelTrip,
    getBookedTrips,
    getBalance,
    addMoney,
    getTripType,
    getTripPriceId,
    getTrips,
    getTripTypePricing,
    getTripTypeId,
    getNumberPersonOnTrip,
    getUserOnTrip,
    joinTrip,
    checkUserInTrip,
    updateTripStatus,
    insertDriver,
    updateDriver,
    getDriver,
    deleteUser,
    getUsersWithActiveStatus,
    viewDriver,
    getAllTripType,
    updateTripType,
    getAllTripTypePricing,
    updateTripTypePricing,
    getAllAreas ,
    updateArea,
    getAllTransactions,
    updateTransaction,
    getAllWallets,
    updateWallet,
    loginAdminStaff,
    getStaff,
    addStaff,
    // checkPaymentStatus,
    // createPayment
} = require('../controllers/authController'); // Import all controller functions
const { validateSignup } = require('../middleware/validate');
const { authenticateToken } = require('../middleware/authenticate'); // Import middleware to validate JWT

// Authentication Routes
router.post('/login', login);
router.post('/loginAdminStaff', loginAdminStaff);

router.post('/google-login', google);
router.post('/signup', validateSignup, signup);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

// Protected Profile Route (JWT Authentication required)
router.get('/profile', authenticateToken, getProfile);
// router.post('/create-payment-link', createPayment);


// Trip Routes
router.get('/locations', getLocations);
router.get('/areas', getAreas);
router.get('/findTrip', findTrip); // Optionally protected depending on your requirement
router.post('/createTrip', createTrip); // Optionally protected
// router.post('/cancelTrip', cancelTrip); // Uncomment when needed
// router.get('/getBookedTrips', getBookedTrips); // Uncomment when needed

// Wallet & Payments Routes
router.get('/getBalance', authenticateToken, getBalance);
// 
// router.get('/checkPaymentStatus', checkPaymentStatus);



// Trip Types, Pricing, and Booking Routes
router.get('/trip-types', getTripType);
router.get('/trip-pricing', getTripPriceId);
router.get('/getTrips', getTrips);
router.get('/getTripTypePricing', getTripTypePricing);
router.get('/getTripTypeId', getTripTypeId);
router.get('/getNumberPersonOnTrip', getNumberPersonOnTrip);
router.get('/getUserOnTrip', getUserOnTrip);
router.post('/joinTrip', joinTrip);
router.get('/checkUserInTrip', checkUserInTrip);
router.post('/updateTripStatus', updateTripStatus);
router.post('/insertDriver', insertDriver);
router.post('/updateDriver', updateDriver);
router.get('/getDriver', getDriver);
router.put('/users/:id', deleteUser); 
router.get('/users/active',getUsersWithActiveStatus)
router.get('/viewDriver', viewDriver);
router.get('/getAllTripType', getAllTripType);
router.post('/updateTripType', updateTripType);
router.get('/getAllTripTypePricing', getAllTripTypePricing);
router.post('/updateTripTypePricing', updateTripTypePricing);
router.get('/getAllAreas', getAllAreas);
router.post('/updateArea', updateArea);
router.get('/getAllTransactions', getAllTransactions);
router.post('/updateTransaction', updateTransaction);
router.get('/getAllWallets', getAllWallets);
router.put('/updateWallet', updateWallet);
router.get('/getStaff', getStaff);
router.post('/addStaff', addStaff);


module.exports = router;
