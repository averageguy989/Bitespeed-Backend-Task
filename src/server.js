import express from 'express';
import prisma from './prisma.js';
import dotenv from 'dotenv';


dotenv.config();



const app = express();
const port = process.env.PORT;

app.use(express.json());

app.post("/identify", async (req, res) => {
  try {
    const { email, phoneNumber } = req.body;

    if(!email && !phoneNumber){
        return res.status(400).json({
            message: "email or phone required"
        })
    }


    const contacts = await prisma.contact.findMany({
      where: {
        OR: [
          { email },
          { phoneNumber }
        ]
      }
    });


    if(contacts.length === 0){
        const newContact = await prisma.contact.create({
            data: {
                email,
                phoneNumber,
                linkPrecedence: "primary",
                linkedId: null
            }
        })

        return res.status(201).json({
            contact: {
                primaryContactId: newContact.id,
                emails: [email],
                phoneNumbers: [phoneNumber],
                secondaryContactIds: []
            }
        })
    }else {

        let primaryContact = contacts.find(
            (contact) => contact.linkPrecedence === "primary"
        )

        if(!primaryContact){
            const secondary = contacts[0];
            primaryContact = await prisma.contact.findUnique({
                where: {
                    id: secondary.linkedId
                }
            })
        }

        const emailExists = contacts.some(c => c.email === email)
        const phoneExists = contacts.some(c => c.phoneNumber === phoneNumber)

        if(!emailExists || !phoneExists){
            const secondaryContact = await prisma.contact.create({
                data: {
                    email,
                    phoneNumber,
                    linkPrecedence: "secondary",
                    linkedId: primaryContact.id
                }
            })
        }

        const primaryIds = new Set()

        for (const contact of contacts) {
            if (contact.linkPrecedence === "primary") {
                primaryIds.add(contact.id)
            } else {
                primaryIds.add(contact.linkedId)
            }
        }

        const primaries = await prisma.contact.findMany({
            where: {
                id: { in: [...primaryIds] }
            },
            orderBy: {
                createdAt: "asc"
            }
        })

        const oldestPrimary = primaries[0]

        if(primaries.length > 1){
            for (let i = 1; i < primaries.length; i++) {

                const otherPrimary = primaries[i]

                await prisma.contact.update({
                    where: { id: otherPrimary.id },
                    data: {
                    linkPrecedence: "secondary",
                    linkedId: oldestPrimary.id
                    }
                })
            }

            await prisma.contact.updateMany({
                where: {
                    linkedId: { in: primaries.slice(1).map(p => p.id) }
                },
                data: {
                    linkedId: oldestPrimary.id
                }
            })
        }


        primaryContact = oldestPrimary

        const userContacts = await prisma.contact.findMany({
            where: {
                OR: [
                    {id: primaryContact.id},
                    {linkedId: primaryContact.id}
                ]
            },
            orderBy: {
                createdAt: "asc"
            }
        })

        const emailSet = new Set();

        userContacts.forEach( c => {
            if(c.email) emailSet.add(c.email);
        })

        const phoneNumberSet = new Set();

        userContacts.forEach( c => {
            if(c.phoneNumber) phoneNumberSet.add(c.phoneNumber);
        })

        const allEmails = [...emailSet];
        const allPhoneNumbers = [...phoneNumberSet];

        const secondaryContactIds = userContacts
            .filter(c => c.linkPrecedence === 'secondary')
            .map(c => c.id)


        return res.status(200).json({
            contact: {
                primaryContactId: primaryContact.id,
                emails: allEmails,
                phoneNumbers: allPhoneNumbers,
                secondaryContactIds
            }
        })
    }

  } catch (err) {
    console.log("server error", err);

    return res.status(500).json({
      success: false,
      message: "Internal Server Error"
    });
  }
});



app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
})