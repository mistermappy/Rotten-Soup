<template>
    <v-app dark>
        <v-container fluid id="main_container">
            <!-- Game Display and HUD-->
            <v-layout row>
                <game-display></game-display>
                <hud></hud>
            </v-layout>
            <!-- Inventory / Shop Modal -->
            <item-transfer-modal></item-transfer-modal>
            <!-- Death Modal-->
            <death-modal></death-modal>

            <!-- Help Dialog -->
            <help-dialog></help-dialog>

            <!-- Mouse Controls Slider  -->
            <div class="mouse_controls">
                <v-layout row align-justify-center>
                    <v-flex xs4>
                        <v-switch
                        color="yellow darken-4"
                        v-model="player.mouseEnabled"
                        ></v-switch>
                    </v-flex>
                    <v-flex xs6 style="padding-left: 20px">
                        <v-icon>mouse</v-icon>
                    </v-flex>
                </v-layout>
            </div>

            <!-- Github Logo -->
            <a id="git_logo" style="text-decoration: none;" target="_blank"
               href="https://github.com/Larkenx/Rotten-Soup">
                <v-btn icon ripple>
                    <i i style="color: white; margin: auto;" class="fa fa-3x fa-github"
                       aria-hidden="true"></i>
                </v-btn>
            </a>

            <!-- Loading Indicator  -->
            <v-card v-if="loading" fluid class="loading">
                <v-progress-circular indeterminate v-bind:size="140" v-bind:width="7" color="yellow darken-4">Loading...</v-progress-circular>
            </v-card>

        </v-container>
    </v-app>
</template>

<script>
import { Game } from '@/assets/js/game/Game.js'
// components
import gameDisplay from './components/GameDisplay.vue'
import itemTransferModal from './components/ItemTransferModal.vue'
import hud from './components/HUD.vue'
import deathModal from './components/DeathModal.vue'
import helpDialog from './components/HelpDialog.vue'
Window.Game = Game
export default {
	name: 'app',
	data() {
		return {
			mouseControls: false,
			loading: true,
			player: null,
			actors: null
		}
	},
	components: {
		'game-display': gameDisplay,
		hud: hud,
		'item-transfer-modal': itemTransferModal,
		'death-modal': deathModal,
		'help-dialog': helpDialog
	},
	created() {
		Game.init()
		this.player = Game.player
	},
	mounted() {
		this.player = Game.player
		document.getElementById('game_container').appendChild(Game.display.getContainer())
		document.getElementById('minimap_container').appendChild(Game.minimap.getContainer())
		Game.log('Welcome to Rotten Soup!', 'information')
		Game.log('Press ? to view the controls.', 'player_move')
		Game.drawViewPort()
		Game.drawMiniMap()
		Game.refreshDisplay()
		setInterval(() => {
			Game.turn++
			Game.updateDisplay()
		}, 500)
		setTimeout(() => {
			this.loading = false
		}, 1000)
	}
}
</script>
<style>
    @import url('https://fonts.googleapis.com/css?family=Droid+Sans+Mono|PT+Mono');

    * {
        font-family: "Droid Sans Mono", monospace;
        -webkit-touch-callout: none; /* iOS Safari */
        -webkit-user-select: none; /* Safari */
        -khtml-user-select: none; /* Konqueror HTML */
        -moz-user-select: none; /* Firefox */
        -ms-user-select: none; /* Internet Explorer/Edge */
        user-select: none; /* Non-prefixed version, currently
    }

    #main_container {
        /*padding: 10px;*/
        /*height: 100%;*/
    }

    #help {
        position: absolute;
        /* left: 50; */
        right:0px;
        top: 0px;
    }

    #git_logo {
        position: absolute;
        padding: 20px;
        bottom: 0px;
        right: 0px;
    }

    .mouse_controls {
        position: absolute;
        /* min-width: 200px; */
        bottom: 0px;
        left: 90%;
    }

    .loading {
        position: absolute;
        padding: 20px;
        /* min-width: 200px; */
        bottom: 50%;
        left: 45%;
    }

    .test {
        background-color: #824d03;
    }

    canvas {
        padding: 0;
        margin: 0;
    }

    /* Overriding Vuetify's tool tip so that it is centered :) */
    [data-tooltip] {
        position: relative;
        text-align: center;
    }

    .modal {
        border: 2px solid #3d3d3d;
        border-radius: 4px;
        background-color: black;
        color: white;
        width: 400px;
        padding: 10px;
        /*height: 600px;*/
        position: absolute;
        left: 20%;
        top: 25%;
        /*margin-left: -150px;*/
        z-index: 2;
        /*margin-top: -150px;*/
    }
</style>
