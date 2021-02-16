const path = require('path')
const http = require('http')
const express = require('express')
const socketio = require('socket.io')
const Filter = require('bad-words')
const generateMessage = require('./utils/messages.js')
const { addUser, removeUser, getUser, getUsersInRoom , getUserByName} = require('./utils/users.js')

const app = express()
const server = http.createServer(app)
const io = socketio(server)

const port = process.env.PORT || 3000
const publicDirectoryPath = path.join(__dirname, '../public')

app.use(express.static(publicDirectoryPath))

io.on('connection' , (socket) => {
    
    socket.on('join' , (options , callback) => {
        const { error, user } = addUser({ id: socket.id , ...options })
        if (error) {
            return callback(error)
        }
        
        socket.join(user.room)
        
        socket.emit( 'receive' , generateMessage('Admin',`Welcome! ${user.username}`) )
        socket.broadcast.to( user.room ).emit('receive' , generateMessage('Admin',`${user.username} has joined!`))
        io.to(user.room).emit('roomData', {
            room: user.room,
            users: getUsersInRoom(user.room)
        })
        callback()
    })

    socket.on('sendMessage' , (message , callback) => {
        const user = getUser(socket.id)

        const filter = new Filter()
        if(filter.isProfane(message)) {
            return callback({username:'Admin', message: 'Profanity is not allowed!'})
        }

        var msg = message.trim()
        if (msg.substr(0, 3) === '@w ') {
            msg = msg.substr(3)
            var ind = msg.indexOf(' ')
            if (ind != -1) {
                var name = msg.substring(0, ind)
                var msg = msg.substring(ind + 1)
                const userTo = getUserByName(name)
                if(userTo) {
                    io.to(userTo.id).emit('whisper', generateMessage(`[${user.username}] `,msg))
                    socket.emit( 'whisper' , generateMessage('You',`[${userTo.username}] : ${msg}`) )
                } else {
                    callback({username:'Admin', message: 'Enter a valid user!'})
                }

            }else {
                callback({username:'Admin', message: 'Enter a message for your whisper!'})
            }
        }
        else {
            if(user) {
                socket.broadcast.to( user.room ).emit('receive' , generateMessage(user.username,message))
                callback({username:'You', message})    
            }
        }
    })

    socket.on('typing', (data) => {
        const user = getUser(socket.id)
        if(user){
            socket.broadcast.to( user.room ).emit('typing',data)
        }
    })


    socket.on('disconnect' , () => {
        const user = removeUser(socket.id)
        if (user) {
            io.to(user.room).emit('receive' , generateMessage('Admin',`${user.username} has left!`))
            io.to(user.room).emit('roomData', {
                room: user.room,
                users: getUsersInRoom(user.room)
            })
        }
    })

})

server.listen(port, () => {
    console.log(`Server is up at port: ${port}!`)
})