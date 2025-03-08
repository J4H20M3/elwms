import SQLite from '../sqlite'

const message = await SQLite.createDB();

console.log(message);

await SQLite.executeQuery({
    sql: `
CREATE TABLE IF NOT EXISTS animals (id INTEGER PRIMARY KEY AUTOINCREMENT, animal VARCHAR(255) UNIQUE, sound VARCHAR(255), icon VARCHAR(255) UNIQUE);
INSERT OR REPLACE INTO animals(id, animal, sound, icon) VALUES 
(1, 'Alligator','Snap!','🐊'),
(2, 'Lion','Roaar!','🦁'),
(3, 'Cat','Meaow!','🐱');`
});

export function insertAnimal({ animal, sound, icon }) {
    return SQLite.executeQuery({
        sql: "INSERT INTO animals(animal, sound, icon) VALUES ($1,$2,$3) RETURNING id;",
        values: [animal, sound, icon],
    });
}
export function deleteAnimal(id) {
    return SQLite.executeQuery({
        sql: "DELETE FROM animals WHERE id=$1;",
        values: [id],
    });
}
export function getAnimals(id) {
    if (id)
        return SQLite.executeQuery({
            sql: "SELECT * FROM animals WHERE id=$1;",
            values: [id]
        });
    else
        return SQLite.executeQuery({
            sql: "SELECT * FROM animals;",
        });
}


