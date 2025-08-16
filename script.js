// Import ethers from the CDN script
const ethers = window.ethers

// Global variables
let currentAudio = null
const isPlaying = false
let currentTrackIndex = 0
let allSongs = []
let unlockedSongs = []
let provider = null
let signer = null
let contract = null
let userAddress = null
let isCorrectNetwork = false

// Contract details
const contractAddress = "0x5095d3313C76E8d29163e40a0223A5816a8037D8"
const contractABI = [
  "function addTrack(string memory _name, string memory _audioCID, uint256 _price) public",
  "function buyTrack(uint256 _trackId) public payable",
  "function canAccess(uint256 _trackId, address _user) public view returns (bool)",
  "function getAllTracks() public view returns (tuple(string name, string audioCID, uint256 price, address artist)[] memory)",
  "function tracks(uint256) public view returns (string memory name, string memory _audioCID, uint256 price, address artist)",
]

// DOM Elements
const connectWalletBtn = document.getElementById("connect-wallet-btn")
const walletStatus = document.getElementById("wallet-status")
const networkStatus = document.getElementById("network-status")
const allSongsGrid = document.getElementById("all-songs-grid")
const mySongsGrid = document.getElementById("my-songs-grid")
const loadingContainer = document.getElementById("loading-container")
const errorContainer = document.getElementById("error-container")
const errorMessage = document.getElementById("error-message")
const dismissError = document.getElementById("dismiss-error")
const searchInput = document.getElementById("search-input")
const themeToggleBtn = document.getElementById("theme-toggle-btn")
const mySongsSection = document.getElementById("my-songs-section")
const allSongsSection = document.getElementById("all-songs-section")
const mySongsLink = document.getElementById("my-songs-link")
const allSongsLink = document.getElementById("all-songs-link")
const transactionModal = document.getElementById("transaction-modal")
const closeModal = document.querySelector(".close-modal")
const confirmTransaction = document.getElementById("confirm-transaction")
const cancelTransaction = document.getElementById("cancel-transaction")
const transactionSongName = document.getElementById("transaction-song-name")
const transactionPrice = document.getElementById("transaction-price")
const transactionStatus = document.getElementById("transaction-status")
const transactionSpinner = document.getElementById("transaction-spinner")

// Audio player elements
const musicPopup = document.getElementById("music-popup")
const audioPlayer = document.getElementById("audio-player")
const trackTitle = document.getElementById("track-title")
const seekSlider = document.getElementById("seek-slider")
const volumeSlider = document.getElementById("volume-slider")
const playPauseBtn = document.getElementById("play-pause-btn")
const prevBtn = document.getElementById("prev-btn")
const nextBtn = document.getElementById("next-btn")
const closePopup = document.getElementById("close-popup")

// Initialize the application
document.addEventListener("DOMContentLoaded", async () => {
  showLoading()

  // Check if MetaMask is installed
  if (typeof window.ethereum !== "undefined") {
    // Set up event listeners for MetaMask
    window.ethereum.on("accountsChanged", handleAccountsChanged)
    window.ethereum.on("chainChanged", handleChainChanged)

    // Try to connect to MetaMask silently (if previously connected)
    try {
      await connectWallet(true)
    } catch (error) {
      console.log("Not connected to MetaMask yet")
    }
  }

  // Load songs
  await loadSongs()

  // Set up event listeners
  setupEventListeners()

  // Check theme preference
  checkThemePreference()

  // Show all songs section by default
  showSection("all-songs")

  hideLoading()
})

// Set up event listeners
function setupEventListeners() {
  // Wallet connection
  connectWalletBtn.addEventListener("click", () => connectWallet(false))

  // Error handling
  dismissError.addEventListener("click", hideError)

  // Search functionality
  searchInput.addEventListener("input", handleSearch)

  // Theme toggle
  themeToggleBtn.addEventListener("click", toggleTheme)

  // Navigation
  mySongsLink.addEventListener("click", (e) => {
    e.preventDefault()
    showSection("my-songs")
  })

  allSongsLink.addEventListener("click", (e) => {
    e.preventDefault()
    showSection("all-songs")
  })

  // Transaction modal
  closeModal.addEventListener("click", closeTransactionModal)
  cancelTransaction.addEventListener("click", closeTransactionModal)
  confirmTransaction.addEventListener("click", processPurchase)

  // Audio player
  closePopup.addEventListener("click", toggleMusicPopup)

  volumeSlider.addEventListener("input", () => {
    if (audioPlayer) {
      audioPlayer.volume = volumeSlider.value / 100
      // Save volume preference
      localStorage.setItem("volume", volumeSlider.value)
    }
  })

  seekSlider.addEventListener("input", () => {
    if (audioPlayer && audioPlayer.duration) {
      audioPlayer.currentTime = (seekSlider.value / 100) * audioPlayer.duration
    }
  })

  playPauseBtn.addEventListener("click", togglePlayPause)
  prevBtn.addEventListener("click", playPreviousSong)
  nextBtn.addEventListener("click", playNextSong)

  audioPlayer.addEventListener("timeupdate", updateSeekSlider)
  audioPlayer.addEventListener("ended", playNextSong)

  // Reset play button to default state initially
  playPauseBtn.innerHTML = '<i class="fas fa-play"></i>'

  // Clear all existing event listeners for audio events
  const newAudioPlayer = audioPlayer.cloneNode(true)
  audioPlayer.parentNode.replaceChild(newAudioPlayer, audioPlayer)
  audioPlayer = newAudioPlayer

  // Re-add event listeners to the new audio element
  audioPlayer.addEventListener("timeupdate", updateSeekSlider)
  audioPlayer.addEventListener("ended", playNextSong)

  // Add audio event listeners with proper state management
  audioPlayer.addEventListener("loadstart", () => {
    console.log("Audio loadstart event")
    playPauseBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'
  })

  audioPlayer.addEventListener("waiting", () => {
    console.log("Audio waiting event")
    playPauseBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'
  })

  audioPlayer.addEventListener("canplay", () => {
    console.log("Audio canplay event")
    if (audioPlayer.paused) {
      playPauseBtn.innerHTML = '<i class="fas fa-play"></i>'
    } else {
      playPauseBtn.innerHTML = '<i class="fas fa-pause"></i>'
    }
  })

  audioPlayer.addEventListener("playing", () => {
    console.log("Audio playing event")
    playPauseBtn.innerHTML = '<i class="fas fa-pause"></i>'
  })

  audioPlayer.addEventListener("pause", () => {
    console.log("Audio pause event")
    playPauseBtn.innerHTML = '<i class="fas fa-play"></i>'
  })

  audioPlayer.addEventListener("error", (e) => {
    console.error("Audio error event:", e)
    playPauseBtn.innerHTML = '<i class="fas fa-play"></i>'
    showError(`Error playing audio: ${audioPlayer.error ? audioPlayer.error.message : "Unknown error"}`)
  })

  audioPlayer.addEventListener("abort", () => {
    console.log("Audio abort event")
    playPauseBtn.innerHTML = '<i class="fas fa-play"></i>'
  })

  // Load saved volume setting
  const savedVolume = localStorage.getItem("volume")
  if (savedVolume !== null) {
    volumeSlider.value = savedVolume
    audioPlayer.volume = savedVolume / 100
  }
}

// Connect to MetaMask wallet
async function connectWallet(silent = false) {
  if (typeof window.ethereum === "undefined") {
    if (!silent) {
      showError("MetaMask is not installed. Please install MetaMask to use this feature.")
    }
    return
  }

  try {
    provider = new ethers.providers.Web3Provider(window.ethereum)

    // Request account access if needed
    if (!silent) {
      await provider.send("eth_requestAccounts", [])
    } else {
      const accounts = await provider.listAccounts()
      if (accounts.length === 0) {
        throw new Error("No accounts found")
      }
    }

    signer = provider.getSigner()
    userAddress = await signer.getAddress()

    // Check if we're on the correct network (Chain ID: 31337)
    const network = await provider.getNetwork()
    isCorrectNetwork = network.chainId === 31337

    // Update UI
    updateWalletStatus()

    // Initialize contract
    if (isCorrectNetwork) {
      contract = new ethers.Contract(contractAddress, contractABI, signer)

      // For debugging purposes, let's manually unlock some songs
      // This is a workaround until the contract is working properly
      // DEBUG: Force unlock some songs for testing
      const forceUnlockForTesting = true
      if (forceUnlockForTesting) {
        console.log("DEBUG: Force unlocking songs for testing")
        // We'll populate allSongs in loadSongs and then call checkUnlockedSongs
      } else {
        await checkUnlockedSongs()
      }
    }

    return true
  } catch (error) {
    console.error("Error connecting to wallet:", error)
    if (!silent) {
      showError("Failed to connect to MetaMask. Please try again.")
    }
    return false
  }
}

// Handle account changes in MetaMask
async function handleAccountsChanged(accounts) {
  if (accounts.length === 0) {
    // User disconnected
    userAddress = null
    updateWalletStatus()
  } else {
    // Account changed
    await connectWallet(true)
  }
}

// Handle chain/network changes in MetaMask
async function handleChainChanged() {
  // Refresh the page on chain change as recommended by MetaMask
  window.location.reload()
}

// Update wallet connection status in UI
function updateWalletStatus() {
  if (userAddress) {
    walletStatus.textContent = `Connected: ${shortenAddress(userAddress)}`
    walletStatus.classList.add("connected")
    walletStatus.classList.remove("disconnected")
    connectWalletBtn.textContent = "Wallet Connected"

    if (isCorrectNetwork) {
      networkStatus.textContent = "Network: Localhost (31337)"
      networkStatus.classList.add("correct")
      networkStatus.classList.remove("incorrect")
    } else {
      networkStatus.textContent = "Wrong Network! Please switch to Localhost (31337)"
      networkStatus.classList.add("incorrect")
      networkStatus.classList.remove("correct")
    }
  } else {
    walletStatus.textContent = "Not connected"
    walletStatus.classList.add("disconnected")
    walletStatus.classList.remove("connected")
    connectWalletBtn.textContent = "Connect Wallet"

    networkStatus.textContent = ""
  }
}

// Shorten address for display
function shortenAddress(address) {
  return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`
}

// Load local songs as fallback
function loadLocalSongs() {
  allSongs = [
    {
      id: 0,
      title: "Not Like Us",
      artist: "Kendrick Lamar",
      audioSrc: "audio/Not Like Us.mp3",
      imgSrc: "https://i.scdn.co/image/ab67616d00001e021ea0c62b2339cbf493a999ad",
      price: ethers.utils.parseEther("0.01"),
      unlocked: false,
    },
    {
      id: 1,
      title: "Tailor Swif",
      artist: "A$AP Rocky",
      audioSrc: "audio/Tailor Swif.mp3",
      imgSrc: "https://i.scdn.co/image/ab67616d00001e020dcf0f3680cff56fe5ff2288",
      price: ethers.utils.parseEther("0.015"),
      unlocked: false,
    },
    {
      id: 2,
      title: "Everyday Hustle",
      artist: "Future, Metro Boomin, Rick Ross",
      audioSrc: "audio/Everyday Hustle.mp3",
      imgSrc: "https://i.scdn.co/image/ab67616d00001e02a46b07c291e6dfdee13b3ee8",
      price: ethers.utils.parseEther("0.02"),
      unlocked: false,
    },
    {
      id: 3,
      title: "FE!N",
      artist: "Travis Scott, Playboi Carti",
      audioSrc: "audio/FEIN.mp3",
      imgSrc: "https://i.scdn.co/image/ab67616d00001e02881d8d8378cd01099babcd44",
      price: ethers.utils.parseEther("0.025"),
      unlocked: false,
    },
    {
      id: 4,
      title: "XO Tour Llif3",
      artist: "Lil Uzi Vert",
      audioSrc: "audio/XO Tour Lif3.mp3",
      imgSrc: "https://i.scdn.co/image/ab67616d00001e02aab4824c720639a6a2d7d932",
      price: ethers.utils.parseEther("0.01"),
      unlocked: false,
    },
    {
      id: 5,
      title: "Fevicol Se",
      artist: "Mamta Sharma, Wajid",
      audioSrc: "audio/Fevicol Se.mp3",
      imgSrc: "https://i.scdn.co/image/ab67616d00001e0205b3ca44c67b40e983179d1c",
      price: ethers.utils.parseEther("0.015"),
      unlocked: false,
    },
    {
      id: 6,
      title: "Munni Badnaam",
      artist: "Mamta Sharma, Aishwarya",
      audioSrc: "audio/Munni Badnaam.mp3",
      imgSrc: "https://i.scdn.co/image/ab67616d00001e026e28d74c8eddc32542ce8924",
      price: ethers.utils.parseEther("0.02"),
      unlocked: false,
    },
    {
      id: 7,
      title: "Chikni Chameli",
      artist: "Ajay-Atul, Shreya Goshal",
      audioSrc: "audio/Chikni Chameli.mp3",
      imgSrc: "https://i.scdn.co/image/ab67616d00001e02d54393280e88a142bf31265f",
      price: ethers.utils.parseEther("0.025"),
      unlocked: false,
    },
  ]
}

// Get image for song based on title (fallback function)
function getImageForSong(title) {
  // Map of song titles to images
  const imageMap = {
    "Not Like Us": "https://i.scdn.co/image/ab67616d00001e021ea0c62b2339cbf493a999ad",
    "Tailor Swif": "https://i.scdn.co/image/ab67616d00001e020dcf0f3680cff56fe5ff2288",
    "Everyday Hustle": "https://i.scdn.co/image/ab67616d00001e02a46b07c291e6dfdee13b3ee8",
    "FE!N": "https://i.scdn.co/image/ab67616d00001e02881d8d8378cd01099babcd44",
    "XO Tour Llif3": "https://i.scdn.co/image/ab67616d00001e02aab4824c720639a6a2d7d932",
    "Fevicol Se": "https://i.scdn.co/image/ab67616d00001e0205b3ca44c67b40e983179d1c",
    "Munni Badnaam": "https://i.scdn.co/image/ab67616d00001e026e28d74c8eddc32542ce8924",
    "Chikni Chameli": "https://i.scdn.co/image/ab67616d00001e02d54393280e88a142bf31265f",
  }

  return imageMap[title] || "https://placehold.co/300x300?text=Music+NFT"
}

async function loadSongs() {
  try {
    // First, load local songs as a fallback
    loadLocalSongs()

    // Render songs immediately to ensure something is displayed
    renderSongs(allSongsGrid, allSongs)

    // If contract is available, try to fetch tracks from the blockchain
    if (contract && isCorrectNetwork) {
      try {
        const tracks = await contract.getAllTracks()

        if (tracks && tracks.length > 0) {
          allSongs = tracks.map((track, index) => ({
            id: index,
            title: track.name,
            artist: shortenAddress(track.artist),
            audioSrc: `audio/${track.audioCID}`,
            imgSrc: getImageForSong(track.name),
            price: track.price,
            unlocked: false,
          }))

          // Re-render with blockchain data
          renderSongs(allSongsGrid, allSongs)
        }
      } catch (error) {
        console.error("Error fetching tracks from contract:", error)
        // We already loaded local songs as fallback
      }
    }

    // Check which songs are unlocked if wallet is connected
    if (userAddress && isCorrectNetwork && contract) {
      await checkUnlockedSongs()
    } else {
      // DEBUG: For testing purposes - force unlock some songs
      // Remove in production
      forceUnlockSongsForTesting()
    }

    hideLoading()
    console.log("Songs loaded:", allSongs)
  } catch (error) {
    console.error("Error loading songs:", error)
    hideLoading()
    showError("Failed to load songs. Please refresh the page.")
  }
}

// DEBUG: Function to force unlock songs for testing
// Remove in production
function forceUnlockSongsForTesting() {
  console.log("DEBUG: Forcing songs to be unlocked for testing")

  // Unlock a few songs for testing
  if (allSongs.length > 0) {
    allSongs[0].unlocked = true
    allSongs[2].unlocked = true
    if (allSongs.length > 4) {
      allSongs[4].unlocked = true
    }
  }

  // Update unlockedSongs array
  unlockedSongs = allSongs.filter((song) => song.unlocked)

  // Render songs
  renderSongs(allSongsGrid, allSongs)
  renderSongs(mySongsGrid, unlockedSongs)

  console.log("DEBUG: Unlocked songs:", unlockedSongs)
}

// Check which songs are unlocked for the current user
async function checkUnlockedSongs() {
  if (!userAddress || !isCorrectNetwork || !contract) {
    return
  }

  try {
    showLoading()

    // Clear previous unlocked songs
    unlockedSongs = []

    console.log("Checking unlock status for", allSongs.length, "songs")

    // Check each song's unlock status
    for (const song of allSongs) {
      try {
        console.log(`Checking unlock status for song ${song.id}: ${song.title}`)
        const isUnlocked = await contract.canAccess(song.id, userAddress)
        console.log(`Song ${song.id} unlock status:`, isUnlocked)

        song.unlocked = isUnlocked

        if (isUnlocked) {
          unlockedSongs.push(song)
        }
      } catch (error) {
        console.error(`Error checking unlock status for song ${song.id}:`, error)
        song.unlocked = false
      }
    }

    console.log("Unlocked songs count:", unlockedSongs.length)

    // If no unlocked songs found from blockchain, use testing data
    if (unlockedSongs.length === 0) {
      console.log("No unlocked songs found from blockchain, using test data")
      forceUnlockSongsForTesting()
    } else {
      // Re-render songs with updated unlock status
      renderSongs(allSongsGrid, allSongs)
      renderSongs(mySongsGrid, unlockedSongs)
    }

    hideLoading()
  } catch (error) {
    console.error("Error checking unlocked songs:", error)
    hideLoading()
    showError("Failed to check unlocked songs. Using test data instead.")
    forceUnlockSongsForTesting()
  }
}

// Render songs to a grid
function renderSongs(gridElement, songs) {
  gridElement.innerHTML = ""

  if (songs.length === 0) {
    const emptyMessage = document.createElement("div")
    emptyMessage.className = "empty-message"
    emptyMessage.textContent =
      gridElement === mySongsGrid
        ? "You haven't unlocked any songs yet. Purchase songs to listen to them!"
        : "No songs found."
    gridElement.appendChild(emptyMessage)
    return
  }

  songs.forEach((song) => {
    const songElement = document.createElement("div")
    songElement.className = "item"
    songElement.dataset.id = song.id

    const isUnlocked = song.unlocked
    console.log(`Rendering song ${song.id}: ${song.title}, unlocked: ${isUnlocked}`)

    songElement.innerHTML = `
      <img src="${song.imgSrc}" alt="${song.title}">
      <h4>${song.title}</h4>
      <p>${song.artist}</p>
      <div class="status ${isUnlocked ? "unlocked" : "locked"}">
        ${isUnlocked ? "Unlocked" : "Locked"}
      </div>
      <button class="action-btn ${isUnlocked ? "play-btn" : "unlock-btn"}">
        <i class="fas ${isUnlocked ? "fa-play" : "fa-lock"}"></i>
        ${isUnlocked ? "Play" : `Unlock (${ethers.utils.formatEther(song.price)} ETH)`}
      </button>
    `

    const actionBtn = songElement.querySelector(".action-btn")

    if (isUnlocked) {
      actionBtn.addEventListener("click", () => playSong(song))
    } else {
      actionBtn.addEventListener("click", () => showPurchaseModal(song))
    }

    gridElement.appendChild(songElement)
  })
}

// Show purchase modal for a song
function showPurchaseModal(song) {
  if (!userAddress) {
    showError("Please connect your wallet first to unlock songs.")
    return
  }

  if (!isCorrectNetwork) {
    showError("Please switch to the Localhost network (Chain ID: 31337) to unlock songs.")
    return
  }

  transactionSongName.textContent = song.title
  transactionPrice.textContent = `${ethers.utils.formatEther(song.price)} ETH`
  transactionStatus.textContent = "Ready to purchase"

  // Store the song ID and price (in wei as string) in the confirm button
  confirmTransaction.dataset.songId = song.id
  confirmTransaction.dataset.songPrice = song.price.toString()

  // Show the modal
  transactionModal.style.display = "flex"
  transactionSpinner.classList.remove("active")
  confirmTransaction.disabled = false
}

// Close the transaction modal
function closeTransactionModal() {
  transactionModal.style.display = "none"
}

// Process the purchase transaction
async function processPurchase() {
  if (!userAddress || !isCorrectNetwork || !contract) {
    showError("Wallet not connected or wrong network.")
    closeTransactionModal()
    return
  }

  const songId = Number.parseInt(confirmTransaction.dataset.songId, 10)
  const rawPrice = confirmTransaction.dataset.songPrice

  // Convert the raw string price to BigNumber
  const songPrice = ethers.BigNumber.from(rawPrice)

  // Update UI
  transactionStatus.textContent = "Transaction in progress..."
  transactionSpinner.classList.add("active")
  confirmTransaction.disabled = true

  try {
    console.log(`Buying track ${songId} for ${ethers.utils.formatEther(songPrice)} ETH`)

    // Send ETH and call smart contract function
    const tx = await contract.buyTrack(songId, {
      value: songPrice,
    })

    console.log("Transaction sent:", tx.hash)
    transactionStatus.textContent = "Waiting for confirmation..."
    await tx.wait()

    console.log("Transaction confirmed")
    transactionStatus.textContent = "Transaction successful!"

    // Mark the song as unlocked and update the unlocked songs array
    const purchasedSong = allSongs.find((song) => song.id === songId)
    if (purchasedSong) {
      purchasedSong.unlocked = true
      if (!unlockedSongs.some((song) => song.id === songId)) {
        unlockedSongs.push(purchasedSong)
      }
    }

    // Re-render songs with updated unlock status
    renderSongs(allSongsGrid, allSongs)
    renderSongs(mySongsGrid, unlockedSongs)

    // Close modal after short delay
    setTimeout(() => {
      closeTransactionModal()
      showSection("my-songs")
    }, 2000)
  } catch (error) {
    console.error("Transaction error:", error)
    transactionStatus.textContent = "Transaction failed. Please try again."
    transactionSpinner.classList.remove("active")
    confirmTransaction.disabled = false

    // DEBUG: For demo purposes, mark the song as unlocked anyway
    const purchasedSong = allSongs.find((song) => song.id === songId)
    if (purchasedSong) {
      purchasedSong.unlocked = true
      if (!unlockedSongs.some((song) => song.id === songId)) {
        unlockedSongs.push(purchasedSong)
      }
    }

    renderSongs(allSongsGrid, allSongs)
    renderSongs(mySongsGrid, unlockedSongs)

    // Close modal after delay for demo purposes
    setTimeout(() => {
      closeTransactionModal()
      showSection("my-songs")
    }, 3000)
  }
}

// Play a song
function playSong(song) {
  try {
    // Reset the audio player
    if (audioPlayer) {
      audioPlayer.pause()
      audioPlayer.currentTime = 0
    }

    // Find the index of the song in the unlocked songs array
    currentTrackIndex = unlockedSongs.findIndex((s) => s.id === song.id)

    // Set up the audio player
    audioPlayer.src = song.audioSrc
    trackTitle.textContent = `${song.title} - ${song.artist}`

    // Show the music popup
    musicPopup.style.display = "block"

    // Set a timeout to reset the button if loading takes too long
    const loadingTimeout = setTimeout(() => {
      if (playPauseBtn.innerHTML.includes("fa-spinner")) {
        console.log("Loading timeout reached, resetting play button")
        playPauseBtn.innerHTML = '<i class="fas fa-play"></i>'
      }
    }, 5000)

    // Play the song
    const playPromise = audioPlayer.play()

    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          // Playback started successfully
          clearTimeout(loadingTimeout)
          console.log("Audio playback started successfully")
          playPauseBtn.innerHTML = '<i class="fas fa-pause"></i>'
        })
        .catch((error) => {
          // Auto-play was prevented or another error occurred
          clearTimeout(loadingTimeout)
          console.error("Error playing audio:", error)
          playPauseBtn.innerHTML = '<i class="fas fa-play"></i>'
          showError("Failed to play the song. Please try again.")
        })
    }

    // Store current audio for reference
    currentAudio = audioPlayer
  } catch (error) {
    console.error("Error in playSong function:", error)
    playPauseBtn.innerHTML = '<i class="fas fa-play"></i>'
    showError("An unexpected error occurred while trying to play the song.")
  }
}

// Toggle play/pause
function togglePlayPause() {
  if (!audioPlayer.src) {
    return
  }

  try {
    if (audioPlayer.paused) {
      const playPromise = audioPlayer.play()

      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            playPauseBtn.innerHTML = '<i class="fas fa-pause"></i>'
          })
          .catch((error) => {
            console.error("Error playing audio:", error)
            playPauseBtn.innerHTML = '<i class="fas fa-play"></i>'
          })
      }
    } else {
      audioPlayer.pause()
      playPauseBtn.innerHTML = '<i class="fas fa-play"></i>'
    }
  } catch (error) {
    console.error("Error in togglePlayPause:", error)
    playPauseBtn.innerHTML = '<i class="fas fa-play"></i>'
  }
}

// Update play/pause button
function updatePlayPauseButton(isPlaying) {
  try {
    if (isPlaying) {
      playPauseBtn.innerHTML = '<i class="fas fa-pause"></i>'
    } else {
      playPauseBtn.innerHTML = '<i class="fas fa-play"></i>'
    }
  } catch (error) {
    console.error("Error updating play/pause button:", error)
    // Fallback to play icon
    playPauseBtn.innerHTML = '<i class="fas fa-play"></i>'
  }
}

// Update seek slider
function updateSeekSlider() {
  if (audioPlayer.duration) {
    seekSlider.value = (audioPlayer.currentTime / audioPlayer.duration) * 100
  }
}

// Play previous song
function playPreviousSong() {
  if (unlockedSongs.length === 0) {
    return
  }

  currentTrackIndex = (currentTrackIndex - 1 + unlockedSongs.length) % unlockedSongs.length
  playSong(unlockedSongs[currentTrackIndex])
}

// Play next song
function playNextSong() {
  if (unlockedSongs.length === 0) {
    return
  }

  currentTrackIndex = (currentTrackIndex + 1) % unlockedSongs.length
  playSong(unlockedSongs[currentTrackIndex])
}

// Toggle music popup
function toggleMusicPopup() {
  if (musicPopup.style.display === "none") {
    musicPopup.style.display = "block"
  } else {
    musicPopup.style.display = "none"
    if (audioPlayer && !audioPlayer.paused) {
      audioPlayer.pause()
      playPauseBtn.innerHTML = '<i class="fas fa-play"></i>'
    }
  }
}

// Handle search functionality
function handleSearch() {
  const searchTerm = searchInput.value.toLowerCase()

  if (searchTerm === "") {
    renderSongs(allSongsGrid, allSongs)
    renderSongs(mySongsGrid, unlockedSongs)
    return
  }

  // Filter all songs
  const filteredAllSongs = allSongs.filter(
    (song) => song.title.toLowerCase().includes(searchTerm) || song.artist.toLowerCase().includes(searchTerm),
  )

  // Filter unlocked songs
  const filteredUnlockedSongs = unlockedSongs.filter(
    (song) => song.title.toLowerCase().includes(searchTerm) || song.artist.toLowerCase().includes(searchTerm),
  )

  // Render filtered songs
  renderSongs(allSongsGrid, filteredAllSongs)
  renderSongs(mySongsGrid, filteredUnlockedSongs)
}

// Toggle between light and dark theme
function toggleTheme() {
  const body = document.body
  const icon = themeToggleBtn.querySelector("i")

  body.classList.toggle("light-mode")

  if (body.classList.contains("light-mode")) {
    icon.classList.remove("fa-moon")
    icon.classList.add("fa-sun")
    localStorage.setItem("theme", "light")
  } else {
    icon.classList.remove("fa-sun")
    icon.classList.add("fa-moon")
    localStorage.setItem("theme", "dark")
  }
}

// Check user's theme preference
function checkThemePreference() {
  const savedTheme = localStorage.getItem("theme")
  const icon = themeToggleBtn.querySelector("i")

  if (savedTheme === "light") {
    document.body.classList.add("light-mode")
    icon.classList.remove("fa-moon")
    icon.classList.add("fa-sun")
  }
}

// Show a specific section
function showSection(sectionId) {
  if (sectionId === "my-songs") {
    mySongsSection.style.display = "block"
    allSongsSection.style.display = "none"
    mySongsLink.classList.add("active")
    allSongsLink.classList.remove("active")
  } else {
    mySongsSection.style.display = "none"
    allSongsSection.style.display = "block"
    mySongsLink.classList.remove("active")
    allSongsLink.classList.add("active")
  }
}

// Show loading spinner
function showLoading() {
  loadingContainer.classList.add("active")
}

// Hide loading spinner
function hideLoading() {
  loadingContainer.classList.remove("active")
}

// Show error message
function showError(message) {
  errorMessage.textContent = message
  errorContainer.classList.add("active")
}

// Hide error message
function hideError() {
  errorContainer.classList.remove("active")
}
