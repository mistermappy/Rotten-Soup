import ROT from 'rot-js'
import { GameMap, getTilesetCoords } from '#/map/GameMap.js'
import GameDisplay from '#/GameDisplay.js'
import { Actor } from '#/entities/actors/Actor.js'
import { Entity } from '#/entities/Entity.js'
import { getItemsFromDropTable } from '#/utils/HelperFunctions.js'

import Item from '#/entities/items/Item.js'
import Player from '#/entities/actors/Player.js'
import { randomDungeon, randomCave } from '#/map/RandomMap.js'
import Door from '#/entities/misc/Door.js'
import Ladder from '#/entities/misc/Ladder.js'
import Chest from '#/entities/misc/Chest.js'

export const tileset = require('@/assets/maps/tileset/compiled_dawnlike.json')
export const overworldMap = require('@/assets/maps/map_file/overworld.json')
export const orcCastle = require('@/assets/maps/map_file/orcCastle.json')
export const graveyard = require('@/assets/maps/map_file/graveyard.json')
export const lichLair = require('@/assets/maps/map_file/lichLair.json')

if (!ROT.isSupported()) {
	alert("The rot.js library isn't supported by your browser.")
}

const targetingBorders = {
	id: 7418,
	visible: true
}
const untargetableBorders = {
	id: 7419,
	visible: true
}

export let Game = {
	overview: null,
	dev: false,
	display: null,
	HUD: null,
	console: null,
	player: null,
	playerLocation: null,
	playerID: 4696,
	loadedIDS: [],
	scheduler: null,
	turn: 0,
	engine: null,
	levels: {},
	currentLevel: 'overworld',
	map: null,
	messageHistory: [],
	tempMessages: [],
	minimap: null,
	selectedTile: null,
	pathToTarget: {},
	enemyCycle: null,
	enemyCycleIndex: 0,

	init(dev = false) {
		this.dev = dev
		this.currentLevel = 'overworld'
		this.levels['graveyard'] = new GameMap(graveyard)
		this.levels['graveyard'].revealed = true
		this.levels['Lich Lair'] = new GameMap(lichLair)
		this.levels['Lich Lair'].revealed = true
		this.levels['overworld'] = new GameMap(overworldMap)
		this.levels['overworld'].revealed = true
		this.levels['Orc Castle'] = new GameMap(orcCastle)

		this.map = this.levels[this.currentLevel]
		this.map.revealed = true
		this.playerLocation = this.map.playerLocation
		/* !Important! - PlayerID must be allocated before other maps are drawn... */
		this.playerID = this.map.playerID
		// Set up the ROT.JS game display
		let tileSet = document.createElement('img')
		tileSet.src = 'static/images/DawnLike/Compiled/compiled_tileset_32x32.png'
		let tileSize = 32
		let tileMap = {}
		/* for (let id of this.loadedIDS) { */
		for (let id in tileset.tileproperties + this.loadedIDS) {
			tileMap[id.toString()] = getTilesetCoords(id)
			if (id in tileset.tileproperties) {
				let properties = tileset.tileproperties[id]
				if (properties.FOV) {
					tileMap[properties.FOV_id] = getTilesetCoords(properties.FOV_id)
				}
				if (properties.animated) {
					tileMap[properties.animated_id] = getTilesetCoords(properties.animated_id)
				}
				if (properties.animated && properties.FOV) {
					tileMap[properties.animated_fov_id] = getTilesetCoords(properties.animated_fov_id)
				}
				if (properties.activated_id) {
					tileMap[properties.activated_id] = getTilesetCoords(properties.activated_id)
				}
			}
		}
		this.displayOptions = {
			width: 35,
			height: 22,
			forceSquareRatio: true,
			layout: 'tile',
			// bg: "transparent",
			tileWidth: tileSize,
			tileHeight: tileSize,
			tileSet: tileSet,
			tileMap: tileMap,
			tileColorize: true
		}

		this.width = this.map.width < this.displayOptions.width ? this.map.width : this.displayOptions.width
		this.height = this.map.height < this.displayOptions.height ? this.map.height : this.displayOptions.height
		this.display = new ROT.Display(this.displayOptions)
		this.player = new Player(this.playerLocation[0], this.playerLocation[1], this.playerID)
		this.map.actors.push(this.player) // add to the list of all actors
		this.map.data[this.playerLocation[1]][this.playerLocation[0]].actors.push(this.player) // also push to the tiles' actors
		this.scheduleAllActors()
		this.drawViewPort()
		this.initializeMinimap()
		this.engine.start() // Start the engine
		tileSet.onload = () => {
			Game.drawViewPort()
			Game.drawMiniMap()
		}
	},

	refreshDisplay() {
		Game.display.setOptions(this.displayOptions)
	},

	scheduleAllActors() {
		// Set up the ROT engine and scheduler
		this.scheduler = new ROT.Scheduler.Simple()
		this.scheduler.add(new GameDisplay(), true)
		this.scheduler.add(this.player, true) // Add the player to the scheduler
		for (let i = 0; i < this.map.actors.length; i++) {
			// Some 'actor' objects do not take turns, such as ladders / items
			if (this.map.actors[i] !== this.player && this.map.actors[i] instanceof Actor) {
				this.scheduler.add(this.map.actors[i], true)
			}
		}
		this.engine = new ROT.Engine(this.scheduler) // Create new engine with the newly created scheduler
	},

	initializeMinimap() {
		/* Create a ROT.JS display for the minimap! */
		this.minimap = new ROT.Display()
		this.minimap.setOptions({
			width: this.map.width,
			height: this.map.height,
			fontSize: 2,
			spacing: 2,
			forceSquareRatio: true
		})
		this.drawMiniMap()
	},

	clearTempLog() {
		this.tempMessages.splice(0, this.tempMessages.length)
	},

	inbounds(x, y) {
		return !(x < 0 || x >= this.map.width || y < 0 || y >= this.map.height)
	},

	changeLevels(newLevel, dir, level) {
		if (this.levels[newLevel] === undefined) {
			// generating a new random room
			if (newLevel.toLowerCase().includes('cave')) {
				this.levels[newLevel] = new GameMap(randomCave(80, 40, dir, level))
			} else {
				this.levels[newLevel] = new GameMap(randomDungeon(40, 40, dir, level))
			}
			this.levels[newLevel].revealed = false
			for (let actor of this.levels[newLevel].actors) {
				if (actor instanceof Chest) {
					// console.log("filling chest with goodies!");
					// we want to populate the chests with loot
					let items = getItemsFromDropTable({
						minItems: 1,
						maxItems: 4,
						dropTable: {
							STRENGTH_POTION: 1,
							HEALTH_POTION: 1,
							STEEL_ARROW: 1,
							MANA_POTION: 1,
							SWORD: 3
						},
						x: actor.x,
						y: actor.y
					})
					items.forEach(item => actor.addToInventory(item))
				}
			}
			// console.log(newLevel + " does not exist, so a new random instance is being created.");
		}

		this.map.playerLocation = [Game.player.x, Game.player.y]
		// Save the old map
		this.levels[this.currentLevel] = this.map // add the old map to 'levels'
		// Unshift player from ladder position (so that when resurfacing, no player is present)
		this.map.data[this.player.y][this.player.x].removeActor(this.player)
		// Add the new GameMap to the game
		this.map = this.levels[newLevel]
		this.currentLevel = newLevel
		this.playerLocation = this.map.playerLocation
		this.player.placeAt(this.playerLocation[0], this.playerLocation[1])
		// before drawing the viewport, we need to clear the screen of whatever was here last
		this.display.clear()

		this.width = this.map.width < this.displayOptions.width ? this.map.width : this.displayOptions.width
		this.height = this.map.height < this.displayOptions.height ? this.map.height : this.displayOptions.height
		this.scheduleAllActors()
		this.drawViewPort()
		this.minimap.setOptions({
			width: this.map.width,
			height: this.map.height,
			fontSize: 2,
			spacing: 2,
			forceSquareRatio: true
		})
		this.minimap.clear()
		this.drawMiniMap()
	},

	drawViewPort() {
		// Camera positions
		let camera = {
			// camera x,y resides in the upper left corner
			x: this.player.x - ~~(Game.width / 2),
			y: this.player.y - ~~(Game.height / 2),
			width: Math.ceil(Game.width),
			height: Game.height
		}
		let startingPos = [camera.x, camera.y]
		if (camera.x < 0) {
			// far left
			startingPos[0] = 0
		}
		if (camera.x + camera.width > Game.map.width) {
			// far right
			startingPos[0] = Game.map.width - camera.width
		}
		if (camera.y <= 0) {
			// at the top of the map
			startingPos[1] = 0
		}
		if (camera.y + camera.height > Game.map.height) {
			// at the bottom of the map
			startingPos[1] = Game.map.height - camera.height
		}
		this.camera = {
			x: startingPos[0],
			y: startingPos[1]
		}
		let endingPos = [startingPos[0] + camera.width, startingPos[1] + camera.height]
		let dx = 0
		let dy = 0
		// Clear the last visible tiles that were available to be seen
		Object.assign(this.map.seen_tiles, this.map.visible_tiles)
		this.map.visible_tiles = {}

		// FOV calculations
		let fov = new ROT.FOV.PreciseShadowcasting(function(x, y) {
			return Game.inbounds(x, y) && Game.map.data[y][x].visible()
		})

		fov.compute(this.player.x, this.player.y, this.player.cb.range, function(x, y, r, visibility) {
			Game.map.visible_tiles[x + ',' + y] = true
		})

		for (let x = startingPos[0]; x < endingPos[0]; x++) {
			for (let y = startingPos[1]; y < endingPos[1]; y++) {
				let tile = this.map.data[y][x]
				if (this.map.revealed) {
					this.drawTile(dx, dy++, tile, false)
				} else {
					if (tile.x + ',' + tile.y in this.map.visible_tiles) {
						this.drawTile(dx, dy++, tile, false)
					} else if (tile.x + ',' + tile.y in this.map.seen_tiles) {
						this.drawTile(dx, dy++, tile, true)
					} else {
						Game.display.draw(dx, dy++, '', 'black', 'black')
					}
				}
			}
			dx++
			dy = 0
		}
	},

	drawTile(x, y, tile, fov) {
		let symbols = tile.getSpriteIDS(this.turn % 2 === 0, fov)
		// if (symbols.some((e) => {return e === "0"})) throw "A tile is empty!"
		// console.log(this.pathToTarget[x+','+y]);
		if (this.pathToTarget[tile.x + ',' + tile.y]) {
			Game.display.draw(x, y, symbols, 'rgba(250,250,0,0.2)', 'rgba(250,250,0,0.2)')
		} else {
			Game.display.draw(x, y, symbols, 'transparent', 'transparent')
		}
	},

	drawMiniMap() {
		let otherActors = this.map.actors.filter(a => {
			return a instanceof Ladder || a instanceof Door
		})
		if (this.map.revealed) {
			for (let y = 0; y < this.map.height; y++) {
				for (let x = 0; x < this.map.width; x++) {
					let tile = this.map.data[y][x]
					if (tile.x + ',' + tile.y in this.map.visible_tiles) {
						this.minimap.draw(x, y, ' ', tile.bg(), this.brightenColor(tile.bg()))
					} else {
						this.minimap.draw(x, y, ' ', tile.bg(), tile.bg())
					}
				}
			}

			for (let a of otherActors) {
				this.minimap.draw(a.x, a.y, ' ', a.fg, a.bg)
			}
		} else {
			for (let y = 0; y < this.map.height; y++) {
				for (let x = 0; x < this.map.width; x++) {
					let tile = this.map.data[y][x]
					if (tile.x + ',' + tile.y in this.map.visible_tiles) {
						this.minimap.draw(x, y, ' ', tile.bg(), this.brightenColor(tile.bg()))
					} else if (tile.x + ',' + tile.y in this.map.seen_tiles) {
						this.minimap.draw(x, y, ' ', tile.bg(), tile.bg())
					}
				}
			}
			for (let a of otherActors) {
				if (a.x + ',' + a.y in this.map.seen_tiles) {
					this.minimap.draw(a.x, a.y, ' ', a.fg, a.bg)
				}
			}
		}
		// Draw the actor in the mini-map
		this.minimap.draw(this.player.x, this.player.y, ' ', 'yellow', 'yellow')
	},

	brightenColor(color) {
		// console.log(color);
		let hsl_color = ROT.Color.rgb2hsl(ROT.Color.fromString(color))
		hsl_color[2] *= 1.25
		return ROT.Color.toRGB(ROT.Color.hsl2rgb(hsl_color))
	},

	updateDisplay() {
		this.drawViewPort()
		this.drawMiniMap()
	},

	getNearbyEnemies() {
		let camera = {
			// camera x,y resides in the upper left corner
			x: this.player.x - ~~(Game.width / 2),
			y: this.player.y - ~~(Game.height / 2),
			width: Math.ceil(Game.width),
			height: Game.height
		}
		let startingPos = [camera.x, camera.y]
		if (camera.x < 0) {
			// far left
			startingPos[0] = 0
		}
		if (camera.x + camera.width > Game.map.width) {
			// far right
			startingPos[0] = Game.map.width - camera.width
		}
		if (camera.y <= 0) {
			// at the top of the map
			startingPos[1] = 0
		}
		if (camera.y + camera.height > Game.map.height) {
			// at the bottom of the map
			startingPos[1] = Game.map.height - camera.height
		}
		this.camera = {
			x: startingPos[0],
			y: startingPos[1]
		}
		let endingPos = [startingPos[0] + camera.width, startingPos[1] + camera.height]
		let dx = 0
		let dy = 0
		let actors = []
		for (let x = startingPos[0]; x < endingPos[0]; x++) {
			for (let y = startingPos[1]; y < endingPos[1]; y++) {
				let tile = this.map.data[y][x]
				if (tile.x + ',' + tile.y in this.map.visible_tiles) {
					actors = actors.concat(tile.actors)
				}

				// if (this.map.revealed) {
				//     actors = actors.concat(tile.actors);
				// } else {
				//     if (tile.x + "," + tile.y in this.map.visible_tiles)
				//         actors = actors.concat(tile.actors);
				// }
			}
			dx++
			dy = 0
		}
		let enemies = actors.filter(actor => {
			return actor.cb !== undefined && actor.cb.hostile
		})

		// we sort the enemies closest to farthest away
		return enemies.sort((a1, a2) => {
			if (a1.distanceTo(this.player) < a2.distanceTo(this.player)) {
				return -1
			} else if (a2.distanceTo(this.player) < a1.distanceTo(this.player)) {
				return 1
			} else {
				return 0
			}
		})
	},

	getClosestEnemyToPlayer() {
		return this.getNearbyEnemies()[0]
	},

	clearSelectedTile() {
		if (this.selectedTile !== null) {
			let actors = Game.map.data[this.selectedTile.y][this.selectedTile.x].actors.filter(obs => {
				return obs.id !== targetingBorders.id && obs.id !== untargetableBorders.id
			})
			Game.map.data[this.selectedTile.y][this.selectedTile.x].actors = actors
			this.selectedTile = null
			this.pathToTarget = {}
		}
		this.clearTempLog() // clear the temporary log which describes the tile we're on
		this.updateDisplay()
	},

	changeSelectedTile(diff) {
		let tile
		if (this.selectedTile === null) {
			tile = {
				x: this.player.x,
				y: this.player.y
			} // haven't selected a tile before or it was cleared
			let x = tile.x + diff[0]
			let y = tile.y + diff[1]
			if (!this.inbounds(x, y)) {
				/* || ! x+','+y in this.map.visible_tiles ) */
				return
			}
		} else {
			// we have had a previously selected tile and need to pop the targeting reticle before pushing it onto the new tile
			tile = this.selectedTile
			let x = tile.x + diff[0]
			let y = tile.y + diff[1]
			if (!this.inbounds(x, y)) {
				/* || ! x+','+y in this.map.visible_tiles) */
				return
			}
			let actors = Game.map.data[tile.y][tile.x].actors.filter(obs => {
				return obs.id !== targetingBorders.id && obs.id !== untargetableBorders.id
			})
			Game.map.data[tile.y][tile.x].actors = actors
		}
		// changed the selected tile to the new tile position selected by movement keys
		this.selectedTile = {
			x: tile.x + diff[0],
			y: tile.y + diff[1]
		}
		let { x, y } = this.selectedTile
		let mapTile = Game.map.data[this.selectedTile.y][this.selectedTile.x]
		let properBorder =
			mapTile.blocked() || this.map.visible_tiles[x + ',' + y] === undefined
				? untargetableBorders
				: targetingBorders
		this.map.data[this.selectedTile.y][this.selectedTile.x].actors.push(properBorder)
		// highlighting the path from the player to the target reticle using bresenham line algorithm
		/* https://rosettacode.org/wiki/Bitmap/Bresenham%27s_line_algorithm#JavaScript */
		this.pathToTarget = {}
		if (properBorder === targetingBorders) {
			let x0 = this.player.x
			let x1 = this.selectedTile.x
			let y0 = this.player.y
			let y1 = this.selectedTile.y
			let dx = Math.abs(x1 - x0),
				sx = x0 < x1 ? 1 : -1
			let dy = Math.abs(y1 - y0),
				sy = y0 < y1 ? 1 : -1
			let err = (dx > dy ? dx : -dy) / 2
			while (!(x0 === x1 && y0 === y1)) {
				this.pathToTarget[x0 + ',' + y0] = true
				let e2 = err
				if (e2 > -dx) {
					err -= dy
					x0 += sx
				}
				if (e2 < dy) {
					err += dx
					y0 += sy
				}
			}
			this.pathToTarget[x0 + ',' + y0] = true
			this.pathToTarget[this.player.x + ',' + this.player.y] = false
		}
		this.describeSelectedTile()
		this.updateDisplay()
		return properBorder === targetingBorders
	},

	selectNearestEnemyTile() {
		this.clearSelectedTile()
		let enemy = this.getClosestEnemyToPlayer()
		if (enemy !== undefined) {
			return this.changeToExactSelectedTile({
				x: enemy.x,
				y: enemy.y
			})
		} else {
			return false
		}
	},

	cycleThroughSelectableEnemies() {
		if (this.enemyCycle === null) {
			this.enemyCycle = this.getNearbyEnemies()
			this.enemyCycleIndex = 0
		}
		// if there's more than one enemy, we can cycle to the next closest enemy
		if (this.enemyCycle.length > 1) {
			this.clearSelectedTile()
			this.enemyCycleIndex += 1
			if (this.enemyCycleIndex === this.enemyCycle.length) {
				this.enemyCycleIndex = 0
			}

			let newTarget = this.enemyCycle[this.enemyCycleIndex]
			return this.changeToExactSelectedTile({
				x: newTarget.x,
				y: newTarget.y
			})
		}
	},

	changeToExactSelectedTile(loc, highlight = true) {
		this.selectedTile = loc
		let mapTile = Game.map.data[this.selectedTile.y][this.selectedTile.x]
		let properBorder =
			mapTile.blocked() || this.map.visible_tiles[this.selectedTile.x + ',' + this.selectedTile.y] === undefined
				? untargetableBorders
				: targetingBorders

		if (!highlight) properBorder = targetingBorders
		this.map.data[this.selectedTile.y][this.selectedTile.x].actors.push(properBorder)
		this.pathToTarget = {}
		if (properBorder === targetingBorders && highlight) {
			let x0 = this.player.x,
				x1 = this.selectedTile.x,
				y0 = this.player.y,
				y1 = this.selectedTile.y,
				dx = Math.abs(x1 - x0),
				sx = x0 < x1 ? 1 : -1,
				dy = Math.abs(y1 - y0),
				sy = y0 < y1 ? 1 : -1,
				err = (dx > dy ? dx : -dy) / 2
			while (!(x0 === x1 && y0 === y1)) {
				this.pathToTarget[x0 + ',' + y0] = true
				let e2 = err
				if (e2 > -dx) {
					err -= dy
					x0 += sx
				}
				if (e2 < dy) {
					err += dx
					y0 += sy
				}
			}
			this.pathToTarget[x0 + ',' + y0] = true
			this.pathToTarget[this.player.x + ',' + this.player.y] = false
		}
		this.updateDisplay()
		this.describeSelectedTile()
		return properBorder === targetingBorders
	},

	redrawSelectedTile(highlight) {
		if (this.selectedTile !== null) {
			let mapTile = Game.map.data[this.selectedTile.y][this.selectedTile.x]
			let properBorder =
				mapTile.blocked() ||
				this.map.visible_tiles[this.selectedTile.x + ',' + this.selectedTile.y] === undefined
					? untargetableBorders
					: targetingBorders

			if (!highlight) properBorder = targetingBorders
			this.map.data[this.selectedTile.y][this.selectedTile.x].actors.push(properBorder)
			this.pathToTarget = {}
			if (properBorder === targetingBorders && highlight) {
				let x0 = this.player.x,
					x1 = this.selectedTile.x,
					y0 = this.player.y,
					y1 = this.selectedTile.y,
					dx = Math.abs(x1 - x0),
					sx = x0 < x1 ? 1 : -1,
					dy = Math.abs(y1 - y0),
					sy = y0 < y1 ? 1 : -1,
					err = (dx > dy ? dx : -dy) / 2
				while (!(x0 === x1 && y0 === y1)) {
					this.pathToTarget[x0 + ',' + y0] = true
					let e2 = err
					if (e2 > -dx) {
						err -= dy
						x0 += sx
					}
					if (e2 < dy) {
						err += dx
						y0 += sy
					}
				}
				this.pathToTarget[x0 + ',' + y0] = true
				this.pathToTarget[this.player.x + ',' + this.player.y] = false
			}
			this.updateDisplay()
			this.describeSelectedTile()
			return properBorder === targetingBorders
		}
		return false
	},

	describeSelectedTile() {
		/* Returns an array of strings describing what exists on the currently selected tile.
        this can be obstacles, items, traps, or enemies */
		let tile = this.map.data[this.selectedTile.y][this.selectedTile.x]
		let names = tile.actors
			.filter(a => {
				return a instanceof Entity && a !== this.player
			})
			.map(a => {
				return a instanceof Item ? a.type.toLowerCase() : a.name.toLowerCase()
			})
		let prettyNames = []
		prettyNames = names.slice(1, -1).reduce((buf, str) => {
			return buf + ', a ' + str
		}, 'a  ' + names.slice(0, 1))

		if (names.length > 1) {
			prettyNames = prettyNames + [` and a ${names.slice(-1)}`]
		} else if (names.length == 0) {
			prettyNames = 'nothing'
		}

		if ((Game.player.targeting || Game.player.casting) && this.selectedTile !== null) {
			let inView = Game.map.data[this.selectedTile.y][this.selectedTile.x].actors.some(obs => {
				return obs.id === untargetableBorders.id
			})
				? ' This tile is out of range or blocked.'
				: ''
			this.log(`[You see ${prettyNames} here.${inView}]`, 'player_move', true)
		} else {
			this.log(`[You see ${prettyNames} here.]`, 'player_move', true)
		}
	},

	getTile(x, y) {
		return this.map.data[y][x]
	},

	printPlayerTile() {
		console.log(Game.map.data[this.player.y][this.player.x])
	},

	eventToTile(evt) {
		let t = Game.display.eventToPosition(evt)
		let x = t[0] + this.camera.x
		let y = t[1] + this.camera.y
		return this.map.data[y][x]
	},

	hoverTile(evt) {
		let t = Game.display.eventToPosition(evt)
		let x = t[0] + this.camera.x
		let y = t[1] + this.camera.y
		this.hoveredTile = t[0] + ',' + t[1]
	},

	log(message, type, tmp = false) {
		let message_color = {
			defend: 'lightblue',
			magic: '#3C1CFD',
			attack: 'red',
			death: 'crimson',
			information: 'yellow',
			player_move: 'grey',
			level_up: 'green',
			alert: 'orange'
		}
		let color = type in message_color ? message_color[type] : type
		if (tmp) this.tempMessages.splice(0, 1, [message, color])
		else this.messageHistory.push([message, color])
	}
}
