/**
 * Covariance Example: Output Positions
 *
 * Covariance allows more specific types to be used where less specific types are expected.
 * This naturally occurs in output positions (return types).
 */

// Define a type hierarchy
class Animal {
  name: string = 'Generic Animal'
}

class Dog extends Animal {
  breed: string = 'Unknown'
  name = 'Dog'
}

class GoldenRetriever extends Dog {
  breed = 'Golden Retriever'
  friendly: boolean = true
}

// Function types with covariant return positions
type GetAnimal = () => Animal
type GetDog = () => Dog
type GetGoldenRetriever = () => GoldenRetriever

// Implementations
const getAnimal: GetAnimal = () => new Animal()
const getDog: GetDog = () => new Dog()
const getGoldenRetriever: GetGoldenRetriever = () => new GoldenRetriever()

// ✅ Covariance in action: Can assign more specific to less specific
const getAnimal2: GetAnimal = getDog // OK! Dog is an Animal
const getAnimal3: GetAnimal = getGoldenRetriever // OK! GoldenRetriever is an Animal
const getDog2: GetDog = getGoldenRetriever // OK! GoldenRetriever is a Dog

// ❌ Cannot go the other way
// @ts-expect-error - Cannot assign less specific to more specific
const getDog3: GetDog = getAnimal // Error! Not all Animals are Dogs

// Practical example: Array of getters
const animalGetters: GetAnimal[] = [
  getAnimal,
  getDog, // ✅ Works due to covariance
  getGoldenRetriever, // ✅ Works due to covariance
]

// All return Animals (or subtypes of Animal)
animalGetters.forEach((getter) => {
  const animal = getter()
  console.log(animal.name) // Safe - all Animals have name
})

// Covariance with union types
type GetStringOrNumber = () => string | number
type GetString = () => string

const getString: GetString = () => 'hello'
const getStringOrNumber: GetStringOrNumber = getString // ✅ string ⊆ string | number

// Covariance with unknown (top type)
type GetUnknown = () => unknown
const getUnknown1: GetUnknown = getString // ✅ string ⊆ unknown
const getUnknown2: GetUnknown = getDog // ✅ Dog ⊆ unknown
