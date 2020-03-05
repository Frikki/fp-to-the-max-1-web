import { co, get, unsafeRun, Resume, resumeNow, resumeLater, use, op } from 'fx-ts'

import './assets/css/main.css'

// -------------------------------------------------------------------
// The number guessing game example from
// https://www.youtube.com/watch?v=sxudIMiOo68

// -------------------------------------------------------------------
// Capabilities the game will need

type Print = { print(s: string): Resume<void> }
const print = (s: string) => op<Print>(c => c.print(s))

type Println = { println(s: string): Resume<void> }
const println = (s: string) => op<Println>(c => c.println(s))

type Delay = { delay(ms: number): Resume<void> }
const delay = (ms: number) => op<Delay>(c => c.delay(ms))

const delayedPrint = co(function*(s: string) {
    yield* print(s)
    yield* delay(2000)
})

type Read = { read(): Resume<string> }
const read = op<Read>(c => c.read())

const ask = co(function*(prompt: string) {
    yield* print(prompt)
    return yield* read
})

const askln = co(function*(prompt: string) {
    yield* println(prompt)
    return yield* read
})

type RandomInt = { randomInt(min: number, max: number): Resume<number> }
const randomInt = (min: number, max: number) => op<RandomInt>(c => c.randomInt(min, max))

// -------------------------------------------------------------------
// The game

// Min/max range for the number guessing game
type GameConfig = {
    min: number
    max: number
}

// Core "business logic": evaluate the user's guess
const checkAnswer = (secret: number, guess: number): boolean => secret === guess

// Play one round of the game.  Generate a number and ask the user
// to guess it.
const play = co(function*(name: string, min: number, max: number) {
    const secret = yield* randomInt(min, max)
    const guess = Number(yield* ask(`Dear ${name}, please guess a number from ${min} to ${max}: `))

    if (!Number.isInteger(guess)) {
        yield* println('You did not enter an integer!')
    } else {
        if (checkAnswer(secret, guess)) yield* print(`You guessed right, ${name}!`)
        else yield* print(`You guessed wrong, ${name}! The number was: ${secret}`)
    }
})

// Ask the user if they want to play again.
// Note that we keep asking until the user gives an answer we recognize
const checkContinue = co(function*(name: string) {
    while (true) {
        const answer = yield* askln(`Do you want to continue, ${name}? (y or n) `)

        switch (answer.toLowerCase()) {
            case 'y':
                return true
            case 'n':
                return false
        }
    }
})

// Main game loop. Play round after round until the user chooses to quit
const main = co(function*() {
    const name = yield* ask('What is your name?')
    yield* delayedPrint(`Hello, ${name} welcome to the game!`)

    const { min, max } = yield* get<GameConfig>()

    do {
        yield* play(name, min, max)
    } while (yield* checkContinue(name))

    yield* print(`Thanks for playing, ${name}.`)
})

// -------------------------------------------------------------------
// Implementations of all the capabilities the game needs.
// The type system will prevent running the game until implementations
// of all capabilities have been provided.
const capabilities = {
    min: 1,
    max: 5,

    print: (s: string): Resume<void> =>
        resumeNow(
            (() => {
                const display = document.getElementById('print-id') as HTMLDivElement
                display.innerHTML = `${s}<br>`
            })(),
        ),

    println: (s: string): Resume<void> =>
        resumeNow(
            (() => {
                const display = document.getElementById('print-id') as HTMLDivElement
                display.insertAdjacentHTML('beforeend', `${s}<br>`)
            })(),
        ),

    delay: (ms: number): Resume<void> =>
        resumeLater(k => {
            const handle = setTimeout(k, ms)
            return () => clearTimeout(handle)
        }),

    read: (): Resume<string> =>
        resumeLater(k => {
            const input = document.getElementById('input-id') as HTMLInputElement
            input.disabled = false
            input.focus()
            input.value = ''
            input.addEventListener('keyup', function handleKeyUp(event: KeyboardEvent) {
                if (event.key === 'Enter') {
                    const value = (event.target as HTMLInputElement).value
                    input.removeEventListener('keyup', handleKeyUp)
                    input.value = ''
                    input.disabled = true
                    return k(value)
                }
            })
            return () => {}
        }),

    randomInt: (min: number, max: number): Resume<number> =>
        resumeNow(Math.floor(min + Math.random() * (max - min))),
}

const init = (document: Document) => {
    document.body.className = 'flex flex-col justify-center bg-gray-400 h-screen'
    const gameBox = document.createElement('div')
    gameBox.className = 'w-2/5 mx-auto flex flex-col p-6 bg-white rounded-lg shadow-xl'
    const textArea = document.createElement('div')
    textArea.id = 'print-id'
    textArea.className = 'text-lg text-gray-900 leading-tight h-12'
    gameBox.appendChild(textArea)
    const input = document.createElement('input')
    input.id = 'input-id'
    input.className =
        'mt-6 bg-gray-200 focus:bg-white border-transparent focus:border-blue-400 text-gray-900 appearance-none py-3 px-4 focus:outline-none border rounded'
    input.disabled = true
    gameBox.appendChild(input)
    document.body.appendChild(gameBox)

    return capabilities
}

unsafeRun(use(main(), init(document)))
