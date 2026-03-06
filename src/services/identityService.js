import prisma from "../prisma.js";



// Find contacts matching email OR phone number
const findMatchingContacts = async (email, phoneNumber) => {

    const filters = [];

    if (email) filters.push({ email });
    if (phoneNumber) filters.push({ phoneNumber });

    const contacts = await prisma.contact.findMany({
        where: {
            OR: filters
        }
    });

    return contacts;
};

// Identify root identities involved

const collectPrimaryIds = (contacts) => {
    const primaryIds = new Set();

    for (const contact of contacts){
        if (contact.linkPrecedence === "primary") {
            primaryIds.add(contact.id)
        } else {
            primaryIds.add(contact.linkedId)
        }
    }

    return [...primaryIds]
}

// Get all primary contacts sorted by age

const getPrimaryContacts = async(primaryIds) => {

    const primaries = await prisma.contact.findMany({
        where: {
            id: { in: primaryIds }
        },
        orderBy: {
            createdAt: "asc"
        }
    })

    return primaries
}


// Merge identity groups
const mergePrimaryContacts = async (primaries) => {


    if (primaries.length === 1) {
        return primaries[0]
    }

    const oldestPrimary = primaries[0];
    const otherPrimaries = primaries.slice(1);

    for(const otherPrimary of otherPrimaries){
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
            linkedId: { in: otherPrimaries.map(p => p.id) }
        },
        data: {
            linkedId: oldestPrimary.id
        }
    })

    return oldestPrimary
}

// Add new email/phone to identity
const createSecondaryContact = async (contacts, email, phoneNumber, primaryId) =>  {

    const emailExists = contacts.some(c => c.email === email)
    const phoneExists = contacts.some(c => c.phoneNumber === phoneNumber)

    if((!emailExists && email) || (!phoneExists && phoneNumber)){
        console.log("Creating new secondary contact for:", { email, phoneNumber });
        await prisma.contact.create({
            data: {
                email,
                phoneNumber,
                linkPrecedence: "secondary",
                linkedId: primaryId
            }
        })
    }

    return;
}


// Retrieve all contacts in identity
const fetchIdentityContacts = async (primaryId) => {
    const allContacts = await prisma.contact.findMany({
        where: {
            OR: [
                { id: primaryId },
                { linkedId: primaryId }
            ]
        }
    })

    return allContacts;
}

// Create final API response
const buildResponse = (allContacts, primaryId) => {
    const emailSet = new Set();
    const phoneSet = new Set();

    allContacts.forEach(contact => {
        if (contact.email) emailSet.add(contact.email);
        if (contact.phoneNumber) phoneSet.add(contact.phoneNumber);
    });

    const secondaryContactIds = allContacts
        .filter(c => c.linkPrecedence === "secondary")
        .map(c => c.id);

    return {
        primaryContactId: primaryId,
        emails: [...emailSet],
        phoneNumbers: [...phoneSet],
        secondaryContactIds
    }
}

// Main function to process identity resolution
export const identifyUser = async (email, phoneNumber) => {
    const contacts = await findMatchingContacts(email, phoneNumber);

    if (contacts.length === 0) {
        const newContact = await prisma.contact.create({
            data: {
                email,
                phoneNumber,
                linkPrecedence: "primary",
                linkedId: null
            }
        })

        return buildResponse([newContact], newContact.id);
    }
    
    const primaryIds = collectPrimaryIds(contacts);
    const primaries = await getPrimaryContacts(primaryIds);   
    const primaryContact = await mergePrimaryContacts(primaries);
    
    await createSecondaryContact(contacts, email, phoneNumber, primaryContact.id);
    const allContacts = await fetchIdentityContacts(primaryContact.id);

    return buildResponse(allContacts, primaryContact.id);
}
