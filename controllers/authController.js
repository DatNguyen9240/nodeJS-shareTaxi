// Import các module cần thiết
const sql = require('mssql');
const jwt = require('jsonwebtoken');
const { pool } = require('../dbConfig'); // Kết nối tới SQL Server
const { createUser } = require('../models/userModel')
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');

// Đăng ký người dùng
exports.signup = async (req, res) => {
  const { name, email, phone, password, birthday } = req.body;

  // Gọi hàm createUser để tạo người dùng
  const userCreated = await createUser(name, email, phone, password, birthday);

  if (userCreated) {
    return res.status(201).json({ message: 'Đăng ký thành công!' });
  } else {
    return res.status(500).json({ message: 'Lỗi khi lưu thông tin người dùng!' });
  }
};

// Đăng nhập Google
exports.google = async (req, res) => {
  const data = req.body;
  // console.log(data.data.email);
  // console.log(data.data.name);
  
  try {
    const poolInstance = await pool; // Use connected pool

    // Check if user exists
    const result = await poolInstance.request()
      .input('Email', sql.NVarChar, data.data.email)
      .query('SELECT Id FROM [User] WHERE Email = @Email');

    const user = result.recordset[0];

    if (user) {
      console.log("cc",user);
      
      // User exists, return existing userId to frontend
      return res.json({ userId: user.Id });
    } else {
      // console.log(data.data.name);
      // console.log(data.data.email);
      
      // User does not exist, insert new user
      const insertResult = await poolInstance.request()
        .input('Name', sql.NVarChar, data.data.name)
        .input('Email', sql.NVarChar, data.data.email)
        .input('PhoneNumber', sql.NVarChar, '') // Set default or retrieve from req.body if available
        .input('Password', sql.NVarChar, '') // Set default or use a generated token/password
        .input('DateOfBirth', sql.Date, null) // Set default or retrieve from req.body if available
        .input('CreatedAt', sql.DateTime, new Date())
        .input('Role', sql.Int, 1) // Set default role (e.g., 1 for normal user)
        .input('Status', sql.Int, 1) // Set default status (e.g., 1 for active)
        .query(`
          INSERT INTO [User] (Name, Email, PhoneNumber, Password, DateOfBirth, CreatedAt, Role, Status) 
          OUTPUT INSERTED.Id 
          VALUES (@Name, @Email, @PhoneNumber, @Password, @DateOfBirth, @CreatedAt, @Role, @Status)
        `);

      const newUserId = insertResult.recordset[0].Id;
      // console.log(newUserId);
      
      // Return new userId to frontend
      return res.json({ userId: newUserId });
    }
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ message: 'Lỗi trong quá trình đăng nhập!', error: error.message });
  }
};



// Đăng nhập
exports.login = async (req, res) => {
  const { Email, Password } = req.body;
  console.log('Login request:', req.body);

  if (!Email || !Password) {
    return res.status(400).json({ message: 'Vui lòng nhập Email và Password!' });
  }

  try {
    const poolInstance = await pool;  // Sử dụng pool đã kết nối
    const result = await poolInstance.request()
      .input('Email', sql.NVarChar, Email)
      .query('SELECT * FROM [User] WHERE Email = @Email');

    const user = result.recordset[0];
    console.log('Retrieved user from DB:', user);

    // Here you should use a secure password check (e.g., bcrypt)
    if (user && Password === user.Password) {
      const token = jwt.sign(
        { userId: user.Id, email: user.Email, name: user.Name, phone: user.PhoneNumber },
        process.env.SECRET_KEY,
        { expiresIn: '1h' }
      );
      return res.json({ token }); // Added userId to the response
    } else {
      return res.status(401).json({ message: 'Email hoặc mật khẩu không chính xác!' });
    }
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ message: 'Lỗi trong quá trình đăng nhập!', error: error.message });
  }
};


exports.loginAdminStaff = async (req, res) => {
  const { email, password } = req.body;
  console.log('Login request:', req.body);

  if (!email || !password) {
    return res.status(400).json({ message: 'Vui lòng nhập Email và Password!' });
  }

  try {
    const poolInstance = await pool; // Use the connected pool
    const result = await poolInstance.request()
      .input('Email', sql.NVarChar, email)
      .query('SELECT * FROM [User] WHERE Email = @Email');

    const user = result.recordset[0];
    console.log('Retrieved user from DB:', user);

    if (!user) {
      return res.status(401).json({ message: 'Người dùng không tồn tại!' });
    }

    // Simple password check (ensure to use bcrypt or another method in production)
    if (password !== user.Password) {
      return res.status(401).json({ message: 'Email hoặc mật khẩu không chính xác!' });
    }

    // Check if user is active (Status = 1)
    if (user.Status !== 1) {
      return res.status(403).json({ message: 'Truy cập bị từ chối. Tài khoản không hoạt động!' });
    }

    // Generate JWT token with necessary user data
    const token = jwt.sign(
      { userId: user.Id, email: user.Email, name: user.Name, phone: user.PhoneNumber, role: user.Role, status: user.Status },
      process.env.SECRET_KEY,
      { expiresIn: '1h' }
    );

    // Respond with the token, status, and role
    return res.json({ token, status: user.Status, role: user.Role });

  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ message: 'Lỗi trong quá trình đăng nhập!', error: error.message });
  }
};


// Lấy thông tin người dùng
exports.getProfile = async (req, res) => {
  const userId = req.query.userId; // Lấy userId từ query parameter

  if (!userId) {
    return res.status(400).json({ message: 'Thiếu userId trong yêu cầu!' });
  }

  console.log(req.user); // Optional: Keep this for debugging

  try {
    const poolInstance = await pool; // Sử dụng pool đã kết nối
    const result = await poolInstance.request()
      .input('id', sql.Int, userId) // Sử dụng userId từ query
      .query('SELECT Email, Name, PhoneNumber, DateOfBirth, CreatedAt FROM [User] WHERE Id = @id');

    const user = result.recordset[0];

    if (!user) {
      return res.status(404).json({ message: 'Người dùng không tồn tại!' });
    }

    return res.json(user); // Trả về thông tin người dùng
  } catch (error) {
    console.error('Get profile error:', error);
    return res.status(500).json({ message: 'Lỗi khi lấy thông tin người dùng!', error: error.message });
  }
};


exports.forgotPassword = async (req, res) => {
  const { email } = req.body;

  try {
    // Tạo reset token với email người dùng và hạn là 1 giờ
    const resetToken = jwt.sign({ email }, process.env.SECRET_KEY, { expiresIn: '1h' });

    // Thực tế: sử dụng dịch vụ email để gửi link này qua email cho người dùng
    console.log(`Send this link to the user's email: http://localhost:5173/api/reset-password/${resetToken}`);

    // Phản hồi về frontend
    res.json({ message: 'Đã gửi email phục hồi mật khẩu!' });
  } catch (error) {
    console.error('Forgot password error:', error);
    return res.status(500).json({ message: 'Lỗi khi gửi email phục hồi mật khẩu!' });
  }
};




// Reset password
exports.resetPassword = async (req, res) => {
  const { token, newPassword } = req.body;

  try {
    const decoded = jwt.verify(token, process.env.SECRET_KEY);  // Verify JWT
    const email = decoded.email;  // Get email from token

    // Update the user's password
    const poolInstance = await pool;
    await poolInstance.request()
      .input('Email', sql.NVarChar, email)
      .input('Password', sql.NVarChar, newPassword)  // Not using bcrypt as per your request
      .query('UPDATE [User] SET Password = @Password WHERE Email = @Email');

    res.json({ message: 'Mật khẩu đã được cập nhật thành công!' });
  } catch (error) {
    console.error('Reset password error:', error);
    return res.status(500).json({ message: 'Lỗi khi đặt lại mật khẩu!', error: error.message });
  }
};


exports.getLocations = async (req, res) => {
  try {
    const poolInstance = await pool; // Sử dụng pool đã kết nối

    // Thay thế với câu truy vấn SQL phù hợp với cấu trúc bảng của bạn
    const result = await poolInstance.request()
      .query('SELECT * FROM [dbo].[Location]'); // Giả sử bạn có bảng Locations

    const locations = result.recordset;

    // Kiểm tra nếu không có địa điểm nào
    if (!locations.length) {
      return res.status(404).json({ message: 'Không tìm thấy địa điểm!' });
    }

    return res.json(locations); // Trả về danh sách địa điểm
  } catch (error) {
    console.error('Get locations error:', error);
    return res.status(500).json({ message: 'Lỗi khi lấy danh sách địa điểm!', error: error.message });
  }
};

exports.getAreas = async (req, res) => {
  try {
    const poolInstance = await pool; // Sử dụng pool đã kết nối

    // Thay thế với câu truy vấn SQL phù hợp với cấu trúc bảng của bạn
    const result = await poolInstance.request()
      .query('SELECT * FROM [dbo].[Area]'); // Giả sử bạn có bảng Locations

    const areas = result.recordset;

    // Kiểm tra nếu không có địa điểm nào
    if (!areas.length) {
      return res.status(404).json({ message: 'Không tìm thấy địa điểm!' });
    }

    return res.json(areas); // Trả về danh sách địa điểm
  } catch (error) {
    console.error('Get locations error:', error);
    return res.status(500).json({ message: 'Lỗi khi lấy danh sách địa điểm!', error: error.message });
  }
};


exports.findTrip = async (req, res) => {
  // Retrieve parameters from query string
  const { leavingFromId, goingToId, date, timeSlot, people } = req.query;

  // Log the request query parameters
  // console.log('Request Query:', req.query);

  // Check if required information is provided in the request
  if (!leavingFromId || !goingToId || !date || !timeSlot || !people) {
    return res.status(400).json({ message: 'Thiếu thông tin trong yêu cầu!' });
  }

  try {
    const poolInstance = await pool;

    const result = await poolInstance.request()
      .input('pickUpLocationId', sql.Int, leavingFromId)
      .input('dropOffLocationId', sql.Int, goingToId)
      .input('BookingDate', sql.DateTime, date)
      .input('HourInDay', sql.Time, timeSlot) // Pass timeSlot directly

      .query(`
        SELECT 
          t.[Id],
          t.[pickUpLocationId],
          t.[dropOffLocationId],
          t.[ToAreaId],
          t.[MaxPerson],
          t.[MinPerson],
          t.[UnitPrice],
          t.[BookingDate],
          t.[HourInDay],
          t.[PricingId],
          t.[TripTypeId],
          (t.MaxPerson - COALESCE(COUNT(b.TripId), 0)) AS AvailableSeats
        FROM 
          [Share_Taxi].[dbo].[Trip] t
        LEFT JOIN 
          [Share_Taxi].[dbo].[Booking] b ON t.Id = b.TripId
        WHERE 
          t.[pickUpLocationId] = @pickUpLocationId AND
          t.[dropOffLocationId] = @dropOffLocationId AND
          t.[BookingDate] = @BookingDate AND
          t.[HourInDay] = @HourInDay
        GROUP BY 
          t.[Id], 
          t.[pickUpLocationId],
          t.[dropOffLocationId],
          t.[ToAreaId],
          t.[MaxPerson],
          t.[MinPerson],
          t.[UnitPrice],
          t.[BookingDate],
          t.[HourInDay],
          t.[PricingId],
          t.[TripTypeId]
      `);

    const trips = result.recordset;

    // Check if there are any trips that can accommodate the requested number of people
    const availableTrips = trips.filter(trip => (trip.MaxPerson - trip.AvailableSeats) >= people);

    if (availableTrips.length === 0) {
      return res.status(404).json({ message: 'Không có chuyến đi nào với số ghế còn trống cho số người yêu cầu!' });
    }
// console.log(trips);

    console.log('Available trips found:', availableTrips); // Print the available trips to the console
    return res.json(trips); // Return the original trip list
  } catch (error) {
    console.error('Find trip error:', error);
    return res.status(500).json({ message: 'Lỗi khi tìm chuyến đi!', error: error.message });
  }
};



exports.getTrips = async (req, res) => {

  try {
    const poolInstance = await pool; // Use the already connected pool
    const result = await poolInstance.request()
      .query(`
        SELECT 
    t.Id AS TripId,
    pl.Name AS PickUpLocationName, -- Thay thế pickUpLocationId bằng Name
    dl.Name AS DropOffLocationName, -- Thay thế dropOffLocationId bằng Name
    t.ToAreaId,
    t.MaxPerson,
    t.MinPerson,
    t.UnitPrice,
    t.BookingDate,
    t.HourInDay,
    t.PricingId,
    t.TripTypeId,
    t.Status
FROM 
    [Share_Taxi].[dbo].[Trip] t
LEFT JOIN 
    [Share_Taxi].[dbo].[Location] pl -- JOIN với bảng Location cho pickUpLocationId
    ON t.pickUpLocationId = pl.Id
LEFT JOIN 
    [Share_Taxi].[dbo].[Location] dl -- JOIN với bảng Location cho dropOffLocationId
    ON t.dropOffLocationId = dl.Id

      `);

    const trips = result.recordset; // Get all trips

    if (trips.length === 0) {
      return res.status(404).json({ message: 'Không có chuyến đi nào!' }); // No trips found
    }

    return res.json(trips); // Return all trips
  } catch (error) {
    console.error('Get trip error:', error);
    return res.status(500).json({ message: 'Lỗi khi lấy thông tin chuyến đi!', error: error.message });
  }
};

exports.updateTripStatus = async (req, res) => {
  const tripId = req.query.TripId; // Correctly retrieve the TripId from query parameters
  const newStatus = req.body.status; // New status is taken from the request body
  
  console.log("New Status: " + newStatus); // Log the new status for debugging

  if (!tripId) {
    return res.status(400).json({ message: 'TripId is required!' });
  }

  if (!newStatus) {
    return res.status(400).json({ message: 'Status is required!' });
  }

  try {
    const poolInstance = await pool; // Use the already connected pool

    // Execute the SQL query to update the status
    const result = await poolInstance.request()
      .input('TripId', sql.Int, tripId) // Pass the TripId as an integer
      .input('Status', sql.VarChar, newStatus) // Input the new status
      .query(`
        UPDATE [Share_Taxi].[dbo].[Trip] -- Make sure the table name is correct
        SET [Status] = @Status -- Use the parameterized status
        WHERE [Id] = @TripId;  -- Use the tripId to update the specific trip
      `);

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ message: 'Trip not found or no update made!' });
    }

    return res.json({ message: 'Trip status updated successfully!' });
  } catch (error) {
    console.error('Update trip status error:', error);
    return res.status(500).json({ message: 'Error updating trip status!', error: error.message });
  }
};


exports.insertDriver = async (req, res) => {
  const { TripId, DriverName, DriverPhone, PlateNumber, ArrivedTime, Status } = req.body;
  
  try {
    const poolInstance = await pool; 
    const result = await poolInstance.request()
      .input('TripId', sql.Int, TripId) // Sử dụng TripId từ req.body
      .input('DriverName', sql.VarChar, DriverName) // Sử dụng DriverName từ req.body
      .input('DriverPhone', sql.VarChar, DriverPhone) // Sử dụng DriverPhone từ req.body
      .input('PlateNumber', sql.VarChar, PlateNumber) // Sử dụng PlateNumber từ req.body
      .input('ArrivedTime', sql.Time, ArrivedTime) // Sử dụng ArrivedTime từ req.body (giả định kiểu TIME)
      .input('Status', sql.Int, Status) // Sử dụng Status từ req.body
      .query(`
        INSERT INTO [Share_Taxi].[dbo].[CarTrip]
        (
            [TripId],
            [DriverName],
            [DriverPhone],
            [PlateNumber],
            [ArrivedTime],
            [Status]
        )
        VALUES 
        (
            @TripId,
            @DriverName,
            @DriverPhone,
            @PlateNumber,
            @ArrivedTime,
            @Status
        );
      `);

    // Trả về kết quả thành công
    res.status(201).json({ message: "Driver inserted successfully!", result });
  } catch (error) {
    console.error('Error inserting driver:', error);
    res.status(500).json({ message: "Error inserting driver. Please try again.", error: error.message });
  }
};


exports.deleteUser = async (req, res) => {
  const userId = req.params.id; // Extract user ID from the request parameters

  if (!userId) {
    return res.status(400).json({ message: 'User ID is required.' });
  }

  try {
    // Create a connection pool to your SQL Server
    const poolInstance = await pool; 

    // Update the user's status to 'inactive' or another appropriate status
    const result = await poolInstance.request()
      .input('userId', sql.Int, userId) // Assuming userId is of type Int
      .input('status', sql.Int, 0) // 0 for 'inactive' or any other status you prefer
      .query('UPDATE [Share_Taxi].[dbo].[User] SET [Status] = @status WHERE [Id] = @userId'); // Update status

    // Check if any rows were affected
    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }

    // Respond with a success message
    return res.status(200).json({ message: 'User status updated successfully.' });
  } catch (error) {
    console.error('Error updating user status:', error); // Log the error for debugging
    return res.status(500).json({ message: 'An error occurred while updating the user status.' });
  } finally {
    // Close the SQL connection if needed
    await sql.close();
  }
};

exports.getUsersWithActiveStatus = async (req, res) => {
  
  try {
    const poolInstance = await pool; 
    const result = await poolInstance.request()
      .query(`
        SELECT TOP (1000) [Id]
      ,[Name]
      ,[Email]
      ,[PhoneNumber]
      ,[Password]
      ,[DateOfBirth]
      ,[CreatedAt]
      ,[Role]
      ,[Status]
  FROM [Share_Taxi].[dbo].[User]
        WHERE [Status] = '1'
      `); // Query all users with Status = 1

    // Check if any users were found
    if (result.recordset.length === 0) {
      return res.status(404).json({ message: 'No active users found.' });
    }

    // Return the list of users with Status = 1
    return res.status(200).json(result.recordset);
  } catch (error) {
    console.error('Error fetching active users:', error); // Log the error for debugging
    return res.status(500).json({ message: 'An error occurred while fetching active users.' });
  } finally {
    // Close the SQL connection if needed
    await sql.close();
  }
};



exports.viewDriver = async (req, res) => {
  const { TripId } = req.query; // Lấy TripId từ query parameters
  // Kiểm tra TripId có tồn tại không
  if (!TripId) {
    return res.status(400).json({ message: "TripId is required." });
  }

  try {
    const poolInstance = await pool; // Kết nối đến pool
    const result = await poolInstance.request()
      .input('TripId', sql.Int, TripId) // Sử dụng input để xử lý TripId an toàn
      .query(`
        SELECT 
          [DriverName],
          [DriverPhone],
          [PlateNumber],
          [ArrivedTime],
          [Status]
        FROM [Share_Taxi].[dbo].[CarTrip]
        WHERE [TripId] = @TripId
      `);

    // Kiểm tra xem có dữ liệu không
    if (result.recordset.length === 0) {
      return res.status(404).json({ message: "No driver found for this TripId." });
    }
    const  results = result.recordset[0]
    // Trả về kết quả
    return res.status(200).json(results); // Chỉ trả về bản ghi đầu tiên
    
    
  } catch (error) {
    console.error('Error fetching driver details:', error);
    return res.status(500).json({ message: "Error fetching driver details. Please try again.", error: error.message });
  }
};



exports.updateDriver = async (req, res) => {
  const { Id, TripId, DriverName, DriverPhone, PlateNumber, ArrivedTime, Status } = req.body;

  try {
    const poolInstance = await pool; 
    const result = await poolInstance.request()
      .input('Id', sql.Int, Id) // Sử dụng Id từ req.body để xác định bản ghi cần cập nhật
      .input('TripId', sql.Int, TripId) // Sử dụng TripId từ req.body
      .input('DriverName', sql.VarChar, DriverName) // Sử dụng DriverName từ req.body
      .input('DriverPhone', sql.VarChar, DriverPhone) // Sử dụng DriverPhone từ req.body
      .input('PlateNumber', sql.VarChar, PlateNumber) // Sử dụng PlateNumber từ req.body
      .input('ArrivedTime', sql.Time, ArrivedTime) // Sử dụng ArrivedTime từ req.body (giả định kiểu TIME)
      .input('Status', sql.Int, Status) // Sử dụng Status từ req.body
      .query(`
        UPDATE [Share_Taxi].[dbo].[CarTrip]
        SET 
            [TripId] = @TripId,
            [DriverName] = @DriverName,
            [DriverPhone] = @DriverPhone,
            [PlateNumber] = @PlateNumber,
            [ArrivedTime] = @ArrivedTime,
            [Status] = @Status
        WHERE [Id] = @Id;  -- Sử dụng @Id để xác định bản ghi cần cập nhật
      `);

    // Trả về kết quả thành công
    res.status(200).json({ message: "Driver updated successfully!", result });
  } catch (error) {
    console.error('Error updating driver:', error);
    res.status(500).json({ message: "Error updating driver. Please try again.", error: error.message });
  }
};

exports.getDriver = async (req, res) => {
  const { TripId } = req.body; // Giả sử bạn chỉ cần TripId để lấy thông tin lái xe

  try {
    const poolInstance = await pool; 
    const result = await poolInstance.request()
      .input('TripId', sql.Int, TripId) // Sử dụng TripId từ req.body
      .query(`
        SELECT TOP (1000) 
          [Id],
          [TripId],
          [DriverName],
          [DriverPhone],
          [PlateNumber],
          [ArrivedTime],
          [Status]
        FROM [Share_Taxi].[dbo].[CarTrip]
        WHERE [TripId] = @TripId;
      `);

    // Trả về kết quả thành công
    res.status(200).json({ message: "Driver fetched successfully!", data: result.recordset });
  } catch (error) {
    console.error('Error fetching driver:', error);
    res.status(500).json({ message: "Error fetching driver. Please try again.", error: error.message });
  }
};



exports.getTripTypePricing = async (req, res) => {
  const tripTypeId = req.query.TripTypeId; // Keep camelCase convention

  if (!tripTypeId) {
    return res.status(400).json({ message: 'TripTypeId is required!' });
  }

  try {
    const poolInstance = await pool; // Assuming pool is already connected elsewhere in the code

    // Correct input name and variable
    const result = await poolInstance.request()
      .input('TripTypeId', sql.Int, tripTypeId) // Correct input
      .query(`
        SELECT TOP (1000) [Id], [Name], [TripType], [MinPerson], [MaxPerson], [PricePerPerson], [Status]
        FROM [Share_Taxi].[dbo].[TripeTypePricing]
        WHERE Id = @TripTypeId
      `);

    const tripTypePricing = result.recordset[0];

    if (!tripTypePricing) {
      return res.status(404).json({ message: 'Trip type pricing not found!' });
    }

    return res.json(tripTypePricing); // Return the trip type pricing data
  } catch (error) {
    console.error('Get trip type pricing error:', error);
    return res.status(500).json({ message: 'Error fetching trip type pricing!', error: error.message });
  }
};




// Example endpoint in Express to fetch pricing
exports.getTripPriceId = async (req, res) => {
  const { maxPerson, minPerson, tripType } = req.query;
  // Kiểm tra xem các tham số đã được cung cấp hay chưa
  if (!maxPerson || !minPerson || !tripType) {
    return res.status(400).json({ message: 'Thiếu thông tin trong yêu cầu!' });
  }

  try {
    const poolInstance = await pool; // Sử dụng pool đã kết nối

    // Truy vấn để lấy thông tin giá của chuyến đi
    const result = await poolInstance.request()
      .input('maxPerson', sql.Int, maxPerson)
      .input('minPerson', sql.Int, minPerson)
      .input('tripType', sql.NVarChar, tripType) // Đảm bảo tripType được xác định với kiểu dữ liệu đúng
      .query(`
        SELECT [Id], [Name], [TripType], [MinPerson], [MaxPerson], [PricePerPerson], [Status]
        FROM [Share_Taxi].[dbo].[TripeTypePricing]
        WHERE MaxPerson = @maxPerson AND MinPerson = @minPerson AND TripType = @tripType
      `);

    const pricingData = result.recordset;

    // Kiểm tra nếu không có dữ liệu giá nào được tìm thấy
    if (!pricingData.length) {
      return res.status(404).json({ message: 'Không tìm thấy dữ liệu giá cho chuyến đi!' });
    }

    return res.json(pricingData); // Trả về dữ liệu giá chuyến đi
  } catch (error) {
    console.error('Error fetching pricing:', error);
    return res.status(500).json({ message: 'Lỗi khi lấy dữ liệu giá!', error: error.message });
  }
};





// Tạo chuyến đi
exports.createTrip = async (req, res) => {
  const {
    pickUpLocationId,
    dropOffLocationId,
    toAreaId,
    maxPerson,
    minPerson,
    unitPrice,
    bookingDate,
    hourInDay,
    pricingId,
    tripTypeId,
  } = req.body;

  // Log input values for debugging
  console.log('Received parameters:', {
    pickUpLocationId,
    dropOffLocationId,
    toAreaId,
    maxPerson,
    minPerson,
    unitPrice,
    bookingDate,
    hourInDay,
    pricingId,
    tripTypeId,
  });

  // Validate the required fields
  if (
    !pickUpLocationId ||
    !dropOffLocationId ||
    !toAreaId ||
    !maxPerson ||
    !minPerson ||
    !unitPrice ||
    !bookingDate ||
    !hourInDay ||
    !pricingId ||
    !tripTypeId
  ) {
    return res.status(400).json({ message: 'Thiếu thông tin trong yêu cầu!' });
  }

  try {
    const poolInstance = await pool;
    const result = await poolInstance.request()
      .input('pickUpLocationId', sql.Int, pickUpLocationId)
      .input('dropOffLocationId', sql.Int, dropOffLocationId)
      .input('ToAreaId', sql.Int, toAreaId)
      .input('MaxPerson', sql.Int, maxPerson)
      .input('MinPerson', sql.Int, minPerson)
      .input('UnitPrice', sql.Float, unitPrice)
      .input('BookingDate', sql.DateTime, bookingDate)
      .input('HourInDay', sql.Time, hourInDay)
      .input('PricingId', sql.Int, pricingId)
      .input('TripTypeId', sql.Int, tripTypeId)
      .query(`
        INSERT INTO [Share_Taxi].[dbo].[Trip] 
        (pickUpLocationId, dropOffLocationId, ToAreaId, MaxPerson, MinPerson, UnitPrice, BookingDate, HourInDay, PricingId, TripTypeId, Status) 
        OUTPUT INSERTED.Id  -- Assuming 'Id' is the name of the primary key column
        VALUES 
        (@pickUpLocationId, @dropOffLocationId, @ToAreaId, @MaxPerson, @MinPerson, @UnitPrice, @BookingDate, @HourInDay, @PricingId, @TripTypeId, '1');
      `);

    const tripId = result.recordset[0].Id; // Get the inserted trip ID

    return res.status(201).json({ 
      message: 'Chuyến đi đã được tạo thành công!',
      tripId, // Send back the trip ID
    });
  } catch (error) {
    console.error('Create trip error:', error);
    return res.status(500).json({ message: 'Lỗi khi tạo chuyến đi!', error: error.message });
  }
};


exports.getTripTypeId = async (req, res) => {
  const { fromAreaId, toAreaId } = req.query;

  // Logging request query for debugging
  // console.log('Received query:', req.query);

  // Check if both fromAreaId and toAreaId are provided
  if (!fromAreaId || !toAreaId) {
    return res.status(400).json({ message: 'Thiếu thông tin FromAreaId hoặc ToAreaId trong yêu cầu!' });
  }

  try {
    // Get database connection pool instance
    const poolInstance = await pool;

    // Execute the query to fetch trip type based on fromAreaId and toAreaId
    const result = await poolInstance.request()
      .input('FromAreaId', sql.Int, fromAreaId)  // Input parameter for FromAreaId
      .input('ToAreaId', sql.Int, toAreaId)      // Input parameter for ToAreaId
      .query(`
        SELECT [Id], [FromAreaId], [ToAreaId], [Name], [Description], [BasicePrice], [Status]
        FROM [Share_Taxi].[dbo].[TripType]
        WHERE FromAreaId = @FromAreaId AND ToAreaId = @ToAreaId
      `);

    const tripTypes = result.recordset;

    // Check if any trip types were found
    if (!tripTypes.length) {
      return res.status(404).json({ message: 'Không tìm thấy loại chuyến đi phù hợp!' });
    }

    // Respond with the found trip types
    return res.json(tripTypes);
  } catch (error) {
    // Log error details and return a 500 status code with the error message
    console.error('Error fetching trip type:', error);
    return res.status(500).json({ message: 'Lỗi khi lấy thông tin loại chuyến đi!', error: error.message });
  }
};

exports.getAllTripType = async (req, res) => {

  try {
    // Get database connection pool instance
    const poolInstance = await pool;

    // Execute the query to fetch all trip types
    const result = await poolInstance.request()
      .query(`
        SELECT TOP (1000) [Id], [FromAreaId], [ToAreaId], [Name], [Description], [BasicePrice], [Status]
        FROM [Share_Taxi].[dbo].[TripType]
      `);

    const tripTypes = result.recordset;

    // Check if any trip types were found
    if (!tripTypes || tripTypes.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy loại chuyến đi nào!' });
    }

    // Respond with the found trip types
    return res.status(200).json({
      message: 'Danh sách loại chuyến đi đã được lấy thành công.',
      data: tripTypes
    });
  } catch (error) {
    // Log error details and return a 500 status code with the error message
    console.error('Error fetching trip types:', error.message); // Log only the error message for better clarity
    return res.status(500).json({
      message: 'Lỗi khi lấy thông tin loại chuyến đi!',
      error: error.message
    });
  }
};


exports.updateTripType = async (req, res) => {
  const { id, name, description, basicPrice, status } = req.body; // Expecting id, name, description, basicPrice, and status in the request body
  
  // Validate input
  if (id == null || name == null || description == null || basicPrice == null || status == null) {
    return res.status(400).json({ message: 'Thiếu thông tin id, tên, mô tả, giá cơ bản hoặc trạng thái!' }); // "Missing id, name, description, basic price, or status information!"
  }

  try {
    // Get database connection pool instance
    const poolInstance = await pool;

    // Execute the update query
    const result = await poolInstance.request()
      .input('Id', sql.Int, id) // Use the appropriate type for Id
      .input('Name', sql.NVarChar, name) // Assuming name is a string
      .input('Description', sql.NVarChar, description) // Assuming description is a string
      .input('BasicePrice', sql.Float, basicPrice) // Assuming basic price is a float
      .input('Status', sql.Int, status) // Assuming status is an integer
      .query(`
        UPDATE [Share_Taxi].[dbo].[TripType]
        SET [Name] = @Name,
            [Description] = @Description,
            [BasicePrice] = @BasicePrice,
            [Status] = @Status
        WHERE [Id] = @Id
      `);

    // Check if any rows were affected
    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ message: 'Không tìm thấy loại chuyến đi với ID đã cho!' }); // "No trip type found with the given ID!"
    }

    // Respond with a success message
    return res.status(200).json({
      message: 'Loại chuyến đi đã được cập nhật thành công!' // "Trip type has been successfully updated!"
    });
  } catch (error) {
    // Log error details and return a 500 status code with the error message
    console.error('Error updating trip type:', error);
    return res.status(500).json({
      message: 'Lỗi khi cập nhật loại chuyến đi!', // "Error updating trip type!"
      error: error.message
    });
  }
};

exports.getStaff = async (req, res) => {
  try {
    // Get the database connection pool instance
    const poolInstance = await pool;

    // Execute the query to fetch all staff users
    const result = await poolInstance.request().query(`
      SELECT TOP (1000) 
        [Id],
        [Name],
        [Email],
        [PhoneNumber],
        [DateOfBirth],
        [CreatedAt],
        [Role],
        [Status]
      FROM [Share_Taxi].[dbo].[User]
      WHERE Role = 'staff'
    `);

    const staffList = result.recordset;

    // Check if any staff records were found
    if (!staffList || staffList.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy nhân viên nào!' });
    }

    // Respond with the found staff records
    return res.status(200).json({
      message: 'Danh sách nhân viên đã được lấy thành công.',
      data: staffList
    });
  } catch (error) {
    // Log error details and return a 500 status code with the error message
    console.error('Error fetching staff:', error.message);
    return res.status(500).json({
      message: 'Lỗi khi lấy danh sách nhân viên!',
      error: error.message
    });
  }
};

exports.addStaff = async (req, res) => {
  try {
    const { Name, Email, PhoneNumber, DateOfBirth, Password } = req.body;

    // Validate the required fields
    if (!Name || !Email || !PhoneNumber || !DateOfBirth || !Password) {
      return res.status(400).json({ message: 'Vui lòng nhập đầy đủ thông tin nhân viên!' });
    }

    // Get the database connection pool instance
    const poolInstance = await pool;

    // Insert the new staff into the User table
    await poolInstance.request()
      .input('Name', Name)
      .input('Email', Email)
      .input('PhoneNumber', PhoneNumber)
      .input('DateOfBirth', DateOfBirth)
      .input('Password', Password)  // Consider hashing the password if it's not already
      .input('Role', 'staff')       // Set Role as 'staff'
      .input('Status', 1)           // Default Status to 'Active'
      .query(`
        INSERT INTO [Share_Taxi].[dbo].[User] (Name, Email, PhoneNumber, DateOfBirth, Password, Role, Status, CreatedAt)
        VALUES (@Name, @Email, @PhoneNumber, @DateOfBirth, @Password, @Role, @Status, GETDATE())
      `);

    // Respond with a success message
    return res.status(201).json({
      message: 'Nhân viên mới đã được thêm thành công!',
    });
  } catch (error) {
    // Log error and return a 500 status code
    console.error('Error adding staff:', error.message);
    return res.status(500).json({
      message: 'Lỗi khi thêm nhân viên mới!',
      error: error.message,
    });
  }
};


exports.getAllTripTypePricing = async (req, res) => {
  try {
    // Get database connection pool instance
    const poolInstance = await pool;

    // Execute the query to fetch all trip type pricing
    const result = await poolInstance.request()
      .query(`
        SELECT TOP (1000) [Id], [Name], [TripType], [MinPerson], [MaxPerson], [PricePerPerson], [Status]
        FROM [Share_Taxi].[dbo].[TripeTypePricing]
      `);

    const tripTypePricing = result.recordset;

    // Check if any trip type pricing records were found
    if (!tripTypePricing || tripTypePricing.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy thông tin giá loại chuyến đi nào!' });
    }

    // Respond with the found trip type pricing records
    return res.status(200).json({
      message: 'Danh sách thông tin giá loại chuyến đi đã được lấy thành công.',
      data: tripTypePricing
    });
  } catch (error) {
    // Log error details and return a 500 status code with the error message
    console.error('Error fetching trip type pricing:', error.message);
    return res.status(500).json({
      message: 'Lỗi khi lấy thông tin giá loại chuyến đi!',
      error: error.message
    });
  }
};


exports.updateTripTypePricing = async (req, res) => {
  const { id, minPerson, maxPerson, pricePerPerson, status } = req.body; // Expecting these fields in the request body

  // Validate input
  if (id == null || minPerson == null || maxPerson == null || pricePerPerson == null || status == null) {
    return res.status(400).json({ message: 'Thiếu thông tin id, minPerson, maxPerson, pricePerPerson hoặc status!' });
  }

  try {
    // Get database connection pool instance
    const poolInstance = await pool;

    // Execute the update query
    const result = await poolInstance.request()
      .input('Id', sql.Int, id)
      .input('MinPerson', sql.Int, minPerson)
      .input('MaxPerson', sql.Int, maxPerson)
      .input('PricePerPerson', sql.Decimal(10, 2), pricePerPerson) // Assuming pricePerPerson is a decimal
      .input('Status', sql.Int, status)
      .query(`
        UPDATE [Share_Taxi].[dbo].[TripeTypePricing]
        SET [MinPerson] = @MinPerson,
            [MaxPerson] = @MaxPerson,
            [PricePerPerson] = @PricePerPerson,
            [Status] = @Status
        WHERE [Id] = @Id
      `);

    // Check if any rows were affected
    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ message: 'Không tìm thấy thông tin giá loại chuyến đi với ID đã cho!' });
    }

    // Respond with a success message
    return res.status(200).json({
      message: 'Thông tin giá loại chuyến đi đã được cập nhật thành công!'
    });
  } catch (error) {
    // Log error details and return a 500 status code with the error message
    console.error('Error updating trip type pricing:', error);
    return res.status(500).json({
      message: 'Lỗi khi cập nhật thông tin giá loại chuyến đi!',
      error: error.message
    });
  }
};

exports.getAllAreas = async (req, res) => {

  try {
    // Get database connection pool instance
    const poolInstance = await pool;

    // Execute the query to fetch all areas
    const result = await poolInstance.request()
      .query(`
        SELECT TOP (1000) [Id], [Name], [Description], [Status]
        FROM [Share_Taxi].[dbo].[Area]
      `);

    const areas = result.recordset;

    // Check if any areas were found
    if (!areas || areas.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy khu vực nào!' });
    }

    // Respond with the found areas
    return res.status(200).json({
      message: 'Danh sách khu vực đã được lấy thành công.',
      data: areas
    });
  } catch (error) {
    // Log error details and return a 500 status code with the error message
    console.error('Error fetching areas:', error.message);
    return res.status(500).json({
      message: 'Lỗi khi lấy thông tin khu vực!',
      error: error.message
    });
  }
};

exports.updateArea = async (req, res) => {
  
  const { id, name, description, status } = req.body; // Expecting these fields in the request body

  // Validate input
  if (id == null || name == null || description == null || status == null) {
    return res.status(400).json({ message: 'Thiếu thông tin id, name, description hoặc status!' });
  }

  try {
    // Get database connection pool instance
    const poolInstance = await pool;

    // Execute the update query
    const result = await poolInstance.request()
      .input('Id', sql.Int, id)
      .input('Name', sql.NVarChar, name) // Assuming name is a string
      .input('Description', sql.NVarChar, description) // Assuming description is a string
      .input('Status', sql.Int, status) // Assuming status is an integer
      .query(`
        UPDATE [Share_Taxi].[dbo].[Area]
        SET [Name] = @Name,
            [Description] = @Description,
            [Status] = @Status
        WHERE [Id] = @Id
      `);

    // Check if any rows were affected
    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ message: 'Không tìm thấy khu vực với ID đã cho!' });
    }

    // Respond with a success message
    return res.status(200).json({
      message: 'Thông tin khu vực đã được cập nhật thành công!'
    });
  } catch (error) {
    // Log error details and return a 500 status code with the error message
    console.error('Error updating area:', error);
    return res.status(500).json({
      message: 'Lỗi khi cập nhật thông tin khu vực!',
      error: error.message
    });
  }
};




// Lấy tất cả giao dịch
exports.getAllTransactions = async (req, res) => {
  try {
    const poolInstance = await pool;
        const result = await poolInstance.request().query(`
      SELECT TOP (1000) 
        [Id], 
        [DepositId], 
        [WalletId], 
        [Amount], 
        [TransactionType], 
        [ReferenceId], 
        [CreatedAt], 
        [Status] 
      FROM [Share_Taxi].[dbo].[Transaction]
    `);
    res.json({ data: result.recordset });
  } catch (error) {
    console.error("Error fetching transactions:", error);
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

// Cập nhật giao dịch
exports.updateTransaction = async (req, res) => {
  const { id, depositId, walletId, amount, transactionType, referenceId, status } = req.body;

  // Kiểm tra các trường dữ liệu đầu vào
  if (!id || !depositId || !walletId || amount == null || !transactionType || !referenceId || status == null) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const poolInstance = await pool;

    const result = await poolInstance.request()
      .input('Id', sql.Int, id)
      .input('DepositId', sql.Int, depositId)
      .input('WalletId', sql.Int, walletId)
      .input('Amount', sql.Float, amount)
      .input('TransactionType', sql.NVarChar, transactionType)
      .input('ReferenceId', sql.NVarChar, referenceId)
      .input('Status', sql.Int, status)
      .query(`
        UPDATE [Share_Taxi].[dbo].[Transaction] 
        SET DepositId = @DepositId, 
            WalletId = @WalletId, 
            Amount = @Amount, 
            TransactionType = @TransactionType, 
            ReferenceId = @ReferenceId, 
            Status = @Status 
        WHERE Id = @Id
      `);

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    res.json({ message: 'Transaction updated successfully' });
  } catch (error) {
    console.error("Error updating transaction:", error);
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

exports.getAllWallets = async (req, res) => {
  try {
    const poolInstance = await pool;
    const result = await poolInstance.request().query('SELECT TOP (1000) [Id], [UserId], [Balance], [CurrencyCode], [CreatedAt], [UpdatedAt], [Status] FROM [Share_Taxi].[dbo].[Wallet]');
    res.json({ data: result.recordset });
  } catch (error) {
    console.error("Error fetching wallets:", error);
    res.status(500).send('Internal Server Error');
  }
};

// Cập nhật ví

exports.updateWallet = async (req, res) => {
  const { id, balance, currencyCode, status } = req.body;

  // Validate input
  if (id == null || balance == null || currencyCode == null || status == null) {
    return res.status(400).json({ message: 'Thiếu thông tin id, balance, currencyCode hoặc status!' });
  }

  try {
    const poolInstance = await pool;
    const result = await poolInstance.request()
      .input('Id', sql.Int, id)
      .input('Balance', sql.Decimal, balance)
      .input('CurrencyCode', sql.NVarChar, currencyCode)
      .input('Status', sql.Int, status)
      .query(`
        UPDATE [Share_Taxi].[dbo].[Wallet]
        SET [Balance] = @Balance,
            [CurrencyCode] = @CurrencyCode,
            [Status] = @Status
        WHERE [Id] = @Id
      `);

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ message: 'Không tìm thấy ví với ID đã cho!' });
    }

    return res.status(200).json({ message: 'Ví đã được cập nhật thành công!' });
  } catch (error) {
    console.error('Error updating wallet:', error);
    return res.status(500).json({ message: 'Lỗi khi cập nhật ví!', error: error.message });
  }
};

exports.getTripType = async (req, res) => {
  const { TripId } = req.query;

  // Validate that TripId exists
  if (!TripId) {
    return res.status(400).json({ message: 'Missing TripId in the request.' });
  }

  try {
    // Get instance of the database connection pool
    const poolInstance = await pool;

    // Execute the query to fetch trip type based on TripId
    const result = await poolInstance.request()
      .input('TripId', sql.Int, TripId) // Set input parameter for TripId
      .query(`
              SELECT TOP (1000) 
    U.[Id] AS UserId,
    U.[Name],
    U.[Email],
    U.[PhoneNumber],
    T.[Description] AS TripTypeDescription
FROM 
    [Share_Taxi].[dbo].[Trip] TR
JOIN 
    [Share_Taxi].[dbo].[TripType] T ON TR.[TripTypeId] = T.[Id] 
JOIN 
    [Share_Taxi].[dbo].[Booking] B ON TR.[Id] = B.[TripId]
JOIN 
    [Share_Taxi].[dbo].[User] U ON B.[UserId] = U.[Id]
WHERE 
    TR.[Id] = @TripId;  

          `);

    const tripUsers = result.recordset; // Corrected variable name for clarity

    // Check if no users were found for the trip
    if (tripUsers.length === 0) {
      return res.status(404).json({ message: 'No users found for the specified trip!' });
    }

    // Group the results by trip type description and users
    const responseData = {
      TripTypeDescription: tripUsers[0].TripTypeDescription,
      Users: tripUsers.map(user => ({
        UserId: user.UserId,
        Name: user.Name,
        Email: user.Email,
        PhoneNumber: user.PhoneNumber,
        DateOfBirth: user.DateOfBirth,
        CreatedAt: user.CreatedAt,
        Role: user.Role,
        Status: user.Status
      }))
    };

    // Respond with the found trip type and user data
    return res.json({ success: true, data: responseData }); // Wrap response in a structured format

  } catch (error) {
    // Log error details and return 500 status code with error message
    console.error('Error fetching trip type:', error);
    return res.status(500).json({ message: 'Error fetching trip type information!', error: error.message });
  }
};



exports.joinTrip = async (req, res) => {
  const { tripId } = req.body; // Extracting tripId from request body
  const userId = req.body.userId; // Extracting userId from the authenticated user
  console.log('Trip ID:', tripId, 'User ID:', userId);

  try {
    // Step 1: Check if the trip exists and is open for joining
    const poolInstance = await pool;
    const tripResult = await poolInstance.request()
      .input('tripId', sql.Int, tripId)
      .query(`
          SELECT TOP (1000) [Id], [pickUpLocationId], [dropOffLocationId],
                 [ToAreaId], [MaxPerson], [MinPerson], [UnitPrice],
                 [BookingDate], [HourInDay], [PricingId], [TripTypeId], [Status]
          FROM [Share_Taxi].[dbo].[Trip]
          WHERE Id = ${tripId} AND [Status] = '1'
      `);

    if (tripResult.recordset.length === 0) {
      return res.status(404).json({ message: 'Trip not found or not open for joining.' });
    }

    // Step 2: Check if the user has already joined the trip
    const bookingResult = await poolInstance.request()
      .input('tripId', sql.Int, tripId)
      .query(`
          SELECT * FROM [Booking] WHERE UserId = ${userId}
      `);

    if (bookingResult.recordset.length > 0) {
      return res.status(400).json({ message: 'User has already joined this trip.' });
    }

    // Optional Step: Check user trip limit (if applicable)
    // Example: const userBookings = await checkUserBookingLimit(userId);
    // if (userBookings >= MAX_LIMIT) return res.status(403).json({ message: 'User has reached the maximum number of bookings.' });

    // Step 3: Insert a new booking record
    const bookingStatus = '1'; // Use a descriptive status

    await poolInstance.request()
      .input('tripId', sql.Int, tripId)
      .input('userId', sql.Int, userId)
      .query(`
          INSERT INTO [Booking] (UserId, TripId, Status) 
          VALUES (${userId}, ${tripId}, ${bookingStatus})
      `);

    // Step 4: Send success response
    return res.status(201).json({ message: 'Successfully joined the trip.' });

  } catch (error) {
    console.error('Error joining trip:', error);
    return res.status(500).json({ message: 'Server error while joining the trip.' });
  }
};


exports.checkUserInTrip = async (req, res) => {
  const { userId } = req.query; // Get userId from query parameters

  // Check if userId is provided
  if (!userId) {
    return res.status(400).json({ message: 'UserId is required.' });
  }
  const poolInstance = await pool;
  try {
    // Query the Booking table for the provided userId
    const result = await poolInstance.request()
      .input('userId', sql.Int, userId) // Define input with name 'userId'
      .query('SELECT * FROM [Booking] WHERE UserId = @userId'); // Use @userId in query

    // Check if any trips are found for the user
    const isUserInTrip = result.recordset.length > 0;
    
    return res.status(200).json({
      isUserInTrip,
      message: isUserInTrip ? 'User is already in a trip.' : 'User is not in any trip.'
    });
    
  } catch (error) {
    console.error('Error checking user trip:', error);
    return res.status(500).json({ message: 'Failed to check user trip. Please try again later.' });
  }
};




exports.getUserOnTrip = async (req, res) => {
  const { tripId } = req.query; // Get TripId from query parameters
  console.log(tripId)
  // Validate tripId
  if (!tripId) {
    return res.status(400).json({ message: 'TripId is required.' });
  }

  try {
    // Use a parameterized query to prevent SQL injection
    const result = await sql.query`SELECT [UserId] FROM [Share_Taxi].[dbo].[Booking] WHERE [TripId] = ${tripId}`;

    // Check if any UserId was found
    if (result.recordset.length > 0) {
      return res.status(200).json({ userIds: result.recordset.map(row => row.UserId) });
    } else {
      return res.status(404).json({ message: 'No UserId found for this TripId.' });
    }
  } catch (error) {
    console.error('Database error while fetching user IDs:', error);
    return res.status(500).json({
      message: 'Error retrieving user IDs from the database.',
      error: error.message
    });
  }
};



exports.getNumberPersonOnTrip = async (req, res) => {
  const { TripId } = req.query;

  // Kiểm tra nếu TripId không có trong yêu cầu
  if (!TripId) {
    return res.status(400).json({ message: 'Thiếu TripId trong yêu cầu.' });
  }

  try {
    // Lấy kết nối tới cơ sở dữ liệu
    const poolInstance = await pool;

    // Truy vấn số người tham gia dựa trên TripId
    const result = await poolInstance.request()
      .input('TripId', sql.Int, TripId)
      .query(`
        SELECT COUNT(*) AS TotalPerson
        FROM [Share_Taxi].[dbo].[Booking]
        WHERE TripId = @TripId;
      `);

    // Lấy số lượng người từ kết quả truy vấn
    const totalPerson = result.recordset[0]?.TotalPerson || 0;

    // Phản hồi nếu không có người tham gia
    if (totalPerson === 0) {
      return res.status(200).json({ message: 'Chưa có người tham gia chuyến đi này.', totalPerson });
    }

    // Phản hồi với số người tham gia chuyến đi
    return res.json({ totalPerson });

  } catch (error) {
    // Xử lý lỗi và phản hồi với mã trạng thái 500
    console.error('Lỗi khi lấy số người tham gia chuyến đi:', error);
    return res.status(500).json({ message: 'Lỗi khi lấy thông tin số người tham gia chuyến đi.', error: error.message });
  }
};




// Hủy chuyến đi
exports.cancelTrip = async (req, res) => {
  const { tripId } = req.body;

  if (!tripId) {
    return res.status(400).json({ message: 'Thiếu tripId trong yêu cầu!' });
  }

  try {
    const poolInstance = await pool;
    const result = await poolInstance.request()
      .input('Id', sql.Int, tripId)
      .query('DELETE FROM [Share_Taxi].[dbo].[Trip] WHERE Id = @Id');

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ message: 'Chuyến đi không tồn tại!' });
    }

    return res.json({ message: 'Chuyến đi đã được hủy thành công!' });
  } catch (error) {
    console.error('Cancel trip error:', error);
    return res.status(500).json({ message: 'Lỗi khi hủy chuyến đi!', error: error.message });
  }
};

// Xem danh sách chuyến đi đã đặt
exports.getBookedTrips = async (req, res) => {
  const userId = req.query.userId; // Lấy userId từ query parameter

  if (!userId) {
    return res.status(400).json({ message: 'Thiếu userId trong yêu cầu!' });
  }

  try {
    const poolInstance = await pool;
    const result = await poolInstance.request()
      .input('UserId', sql.Int, userId) // Giả sử có trường UserId trong bảng Trip
      .query(`
        SELECT * FROM [Share_Taxi].[dbo].[Trip]
        WHERE UserId = @UserId
      `);

    const trips = result.recordset;

    if (!trips.length) {
      return res.status(404).json({ message: 'Không tìm thấy chuyến đi đã đặt!' });
    }

    return res.json(trips); // Trả về danh sách chuyến đi đã đặt
  } catch (error) {
    console.error('Get booked trips error:', error);
    return res.status(500).json({ message: 'Lỗi khi lấy danh sách chuyến đi đã đặt!', error: error.message });
  }
};

// Đặt lại thông tin chuyến đi (nếu cần)
exports.updateTrip = async (req, res) => {
  const { tripId, pickUpLocationId, dropOffLocationId, toAreaId, maxPerson, minPerson, unitPrice, bookingDate, hourInDay, pricingId, tripTypeId } = req.body;

  if (!tripId) {
    return res.status(400).json({ message: 'Thiếu tripId trong yêu cầu!' });
  }

  try {
    const poolInstance = await pool;
    await poolInstance.request()
      .input('Id', sql.Int, tripId)
      .input('pickUpLocationId', sql.Int, pickUpLocationId)
      .input('dropOffLocationId', sql.Int, dropOffLocationId)
      .input('ToAreaId', sql.Int, toAreaId)
      .input('MaxPerson', sql.Int, maxPerson)
      .input('MinPerson', sql.Int, minPerson)
      .input('UnitPrice', sql.Float, unitPrice)
      .input('BookingDate', sql.DateTime, bookingDate)
      .input('HourInDay', sql.Time, hourInDay)
      .input('PricingId', sql.Int, pricingId)
      .input('TripTypeId', sql.Int, tripTypeId)
      .query(`
        UPDATE [Share_Taxi].[dbo].[Trip]
        SET pickUpLocationId = @pickUpLocationId,
            dropOffLocationId = @dropOffLocationId,
            ToAreaId = @ToAreaId,
            MaxPerson = @MaxPerson,
            MinPerson = @MinPerson,
            UnitPrice = @UnitPrice,
            BookingDate = @BookingDate,
            HourInDay = @HourInDay,
            PricingId = @PricingId,
            TripTypeId = @TripTypeId
        WHERE Id = @Id;
      `);

    return res.json({ message: 'Chuyến đi đã được cập nhật thành công!' });
  } catch (error) {
    console.error('Update trip error:', error);
    return res.status(500).json({ message: 'Lỗi khi cập nhật chuyến đi!', error: error.message });
  }
};


// Lấy số dư ví hiện tại
exports.getBalance = async (req, res) => {
  // Lấy token từ header Authorization
  const token = req.headers['authorization']?.split(' ')[1];
  
  // Kiểm tra xem token có được cung cấp hay không
  if (!token) {
      return res.status(401).json({ message: 'Token không được cung cấp!' });
  }

  // Xác thực token
  try {
      const decoded = jwt.verify(token, process.env.SECRET_KEY || 'nmfjkenjfnejnf'); // Sử dụng SECRET_KEY
      const userId = decoded.userId; // Lấy userId từ token

      // Kiểm tra xem userId có hợp lệ không
      if (!userId) {
          return res.status(400).json({ message: 'Thiếu userId trong token!' });
      }

      const poolInstance = await pool; // Kết nối đến cơ sở dữ liệu
      const result = await poolInstance.request()
          .input('UserId', sql.Int, userId) // Thêm userId vào truy vấn
          .query(`
              SELECT TOP (1) 
                  [Id], 
                  [UserId], 
                  [Balance], 
                  [CurrencyCode], 
                  [CreatedAt], 
                  [UpdatedAt], 
                  [Status] 
              FROM [Share_Taxi].[dbo].[Wallet] 
              WHERE [UserId] = @UserId
          `);

      // Nếu không tìm thấy ví, trả về số dư 0
      if (result.recordset.length === 0) {
          return res.json({ balance: 0 });
      }

      const balance = result.recordset[0].Balance; // Lấy số dư từ kết quả
      return res.json({ balance }); // Trả về số dư
  } catch (error) {
      // Ghi log lỗi và trả về thông báo lỗi cho người dùng
      console.error('Get balance error:', error);
      return res.status(500).json({ message: 'Lỗi khi lấy số dư ví!', error: error.message });
  }
};



// Thêm tiền vào ví
exports.addMoney = async (req, res) => {
  const { userId, amount } = req.body;

  if (!userId || !amount) {
    return res.status(400).json({ message: 'Thiếu thông tin trong yêu cầu!' });
  }

  try {
    const poolInstance = await pool;
    const result = await poolInstance.request()
      .input('UserId', sql.Int, userId)
      .input('Amount', sql.Decimal(18, 2), amount)
      .query(`
        UPDATE [User]
        SET Balance = Balance + @Amount
        OUTPUT INSERTED.Balance AS NewBalance
        WHERE Id = @UserId
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy người dùng!' });
    }

    const newBalance = result.recordset[0].NewBalance;
    return res.json({ newBalance });
  } catch (error) {
    console.error('Add money error:', error);
    return res.status(500).json({ message: 'Lỗi khi thêm tiền vào ví!', error: error.message });
  }
};

// exports.checkPaymentStatus = async (req, res) => {
//   const userId = req.query.userId;

//   try {
//       const checkTransactions = async () => {
//           const response = await fetch(process.env.API_GET_PAID, {
//               method: 'GET',
//               headers: {
//                   Authorization: `apikey ${process.env.API_KEY_BANK}`,
//                   "Content-Type": "application/json",
//               },
//           });
//           const data = await response.json();
//           const paymentRecords = data.data.records;
//           const poolInstance = await pool;

//           for (const record of paymentRecords) {
//               const { id, when, description, amount } = record;

//               // Kiểm tra giao dịch đã tồn tại
//               const result = await poolInstance.request()
//                   .input('TransactionId', sql.BigInt, id)
//                   .query('SELECT TOP 1 * FROM [dbo].[Transaction] WHERE [Id] = @TransactionId');

//               if (result.recordset.length === 0) {
//                   const match = description.match(/UID\s*(\d+)/);

//                   if (match) {
//                       const matchedUserId = parseInt(match[1]);

//                       // So sánh với userId từ yêu cầu
//                       if (matchedUserId === parseInt(userId)) {
//                           // Kiểm tra ví của người dùng
//                           const walletResult = await poolInstance.request()
//                               .input('UserId', sql.Int, matchedUserId)
//                               .query(`
//                               SELECT TOP 1 
//                                   [Id],
//                                   [UserId],
//                                   [Balance],
//                                   [UpdatedAt]
//                               FROM [Share_Taxi].[dbo].[Wallet]
//                               WHERE [UserId] = @UserId
//                           `);

//                           if (walletResult.recordset.length > 0) {
//                               // Người dùng đã có ví, cập nhật số dư
//                               const wallet = walletResult.recordset[0];
//                               const updatedAt = wallet.UpdatedAt;

//                               if (new Date(when) > new Date(updatedAt)) {
//                                   await poolInstance.request()
//                                       .input('Balance', sql.Float, amount)
//                                       .input('UpdatedAt', sql.DateTime, new Date())
//                                       .input('UserId', sql.Int, matchedUserId)
//                                       .query('UPDATE [dbo].[Wallet] SET Balance = Balance + @Balance, UpdatedAt = @UpdatedAt WHERE UserId = @UserId');

//                                   console.log(`Cập nhật số dư cho userId: ${matchedUserId} với số tiền: ${amount}`);
//                                   return { success: true, message: 'Transaction successful!', amount };
//                               }
//                           } else {
//                               // Người dùng chưa có ví, tạo ví mới
//                               await poolInstance.request()
//                                   .input('UserId', sql.Int, matchedUserId)
//                                   .input('Balance', sql.Float, amount)
//                                   .input('CreatedAt', sql.DateTime, new Date())
//                                   .input('UpdatedAt', sql.DateTime, new Date())
//                                   .query(`
//                                       INSERT INTO [dbo].[Wallet] ([UserId], [Balance], [CreatedAt], [UpdatedAt]) 
//                                       VALUES (@UserId, @Balance, @CreatedAt, @UpdatedAt)
//                                   `);

//                               console.log(`Tạo ví mới cho userId: ${matchedUserId} với số tiền: ${amount}`);
//                               return { success: true, message: 'Transaction successful!', amount };
//                           }
//                       }
//                   }
//               }
//           }

//           return { success: false, message: 'No new transactions found.' };
//       };

//       const pollForTransaction = async () => {
//           while (true) { // Vòng lặp kiểm tra liên tục
//               const transactionResult = await checkTransactions();

//               if (transactionResult.success) {
//                   console.log(`Giao dịch thành công: ${transactionResult.amount}`);
//                   res.json(transactionResult); // Trả về phản hồi thành công
//                   break; // Dừng vòng lặp khi thành công
//               } else {
//                   console.log(transactionResult.message);
//                   await new Promise(resolve => setTimeout(resolve, 2000)); // Chờ 2 giây trước khi kiểm tra lại
//               }
//           }
//       };

//       pollForTransaction(); // Bắt đầu kiểm tra giao dịch

//   } catch (error) {
//       console.error('Error checking payment status:', error.message);
//       res.status(500).json({ success: false, message: 'Error checking payment status.' });
//   }
// };

// Thêm delay để giảm tần suất yêu cầu
// const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
// const PayOS = require('@payos/node');

// exports.createPayment = async (req, res) => {
//   console.log("cc");
  

//   try {
//     const payos = new PayOS(
//       '8a84bcaa-0309-4cff-8dab-f2142b408bb4', 
//       'd4b52649-8486-4396-8f71-ca6857d6f105', 
//       '14a9c1e06c81e0d2ee61f469430c81fa089d0b28e9428f014b533e81638d15fa'
//     );

//     const orderCode = Date.now() % 1000000000;

//     const order = {
//       amount: 10000,
//       description:'Nap tien chuyen di',
//       orderCode: orderCode,
//       returnUrl: `http://localhost:5173/wallet`,
//       cancelUrl: `http://localhost:5173/wallet`
//     };

//     const paymentLink = await payos.createPaymentLink(order);
//     res.status(303).json({ redirectUrl: paymentLink.checkoutUrl });

//   } catch (error) {
//     console.error('Error handling payment:', error);
//     return res.status(500).json({
//       success: false,
//       message: 'Failed to process deposit. Please try again.'
//     });
//   }
// };








