import express from 'express';
import prisma from './prisma.js';
import dotenv from 'dotenv';
import {identifyUser} from './services/identityService.js';


dotenv.config();



const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());



app.post("/identify", async (req, res) => {
    const { email, phoneNumber } = req.body;

    if(!email && !phoneNumber) {
        return res.status(400).json({
            success: false,
            message: "Email and phone number are required"
        });
    }

   try {

        const phone = phoneNumber?.toString() || null;
        const user = await identifyUser(email, phone);

        return res.status(200).json({
            data: user
        })

   } catch (error){

        console.error("Error identifying user:", error);
        return res.status(500).json({
            success: false,
            message: "An error occurred while identifying the user"
        });

   }
});

app.use((req, res) => {
    res.status(404).json({
        message: "Endpoint not found.Use /identify to identify a user."
    })
})


app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
})