exports.validateSignup = (req, res, next) => {
    const { name, email, phone, password, confirmPassword, birthday } = req.body;
    console.log(req.body)
    // Check for missing fields
    if (!name || !email || !phone || !password || !confirmPassword || !birthday) {
        return res.status(400).json({ message: 'Vui lòng nhập đầy đủ thông tin!' });
    }

    // Check if passwords match
    if (password !== confirmPassword) {
        return res.status(400).json({ message: 'Mật khẩu không khớp!' });
    }

    // Validate email format
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email)) {
        return res.status(400).json({ message: 'Email không hợp lệ!' });
    }

    // Validate phone number format (10-15 digits)
    const phonePattern = /^[0-9]{10,15}$/;
    if (!phonePattern.test(phone)) {
        return res.status(400).json({ message: 'Số điện thoại không hợp lệ!' });
    }

    // Validate birthday format (yyyy-mm-dd)
    const birthdayPattern = /^\d{4}-\d{2}-\d{2}$/; // yyyy-mm-dd
    if (!birthdayPattern.test(birthday)) {
        return res.status(400).json({ message: 'Ngày sinh không hợp lệ! Định dạng: yyyy-mm-dd' });
    }

    // Optional: Check if the date is valid (e.g., not February 30th)
    const date = new Date(birthday);
    if (date.getFullYear() != birthday.split('-')[0] || date.getMonth() + 1 != birthday.split('-')[1] || date.getDate() != birthday.split('-')[2]) {
        return res.status(400).json({ message: 'Ngày sinh không hợp lệ! Vui lòng kiểm tra lại.' });
    }

    // Proceed to the next middleware
    next();
};
