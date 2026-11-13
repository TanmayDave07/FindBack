
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {

    // 1. Categories
    const categories = [
        "Phone",
        "Charger",
        "Macbook",
        "Wallet",
        "Documents",
        "ID Card",
        "Bags",
        "Clothing",
        "Accessories",
        "Keys",
        "Person",
        "Other"
    ];

    // 2. Campus locations
    const locations = [
        "A Block",
        "B Block",
        "C Block",
        "R1",
        "R2",
        "R3",
        "R4",
        "LA (Learners Arena)",
        "A Block Mess",
        "Pushpa Devi Mess",
        "Chai Adda",
        "Foot Ball Ground",
        "Main Ground",
        "Other"
    ];

    // 3. Insert categories (skip existing records)
    await prisma.category.createMany({
        data: categories.map(name => ({ name })),
        skipDuplicates: true
    });

    console.log("Categories updated!");

    // 4. Insert locations (skip existing records)
    await prisma.location.createMany({
        data: locations.map(name => ({ name })),
        skipDuplicates: true
    });

    console.log("Locations updated!");

    // 5. Find obsolete locations that are still being used
    const obsoleteLocations = await prisma.location.findMany({
        where: {
            name: { notIn: locations },
            reports: { some: {} }
        },
        select: { name: true }
    });

    if (obsoleteLocations.length > 0) {
        throw new Error(
            `Old locations still have reports: ${
                obsoleteLocations.map(l => l.name).join(", ")
            }. Reassign those reports before deleting them.`
        );
    }

    // 6. Delete obsolete, unused locations
    const deleted = await prisma.location.deleteMany({
        where: {
            name: { notIn: locations }
        }
    });

    console.log(`${deleted.count} old locations removed!`);

    console.log("Reclaim seed completed successfully!");
}

main()
    .catch(error => {
        console.error("Seeding failed:", error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
