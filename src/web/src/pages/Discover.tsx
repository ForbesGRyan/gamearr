import {
  DiscoverTabs,
  FilterPanel,
  TrendingControls,
  GamesGrid,
  TorrentSearch,
  TorrentsTable,
  TorrentsMobileView,
  TorrentDetailsModal,
  useDiscoverState,
} from '../components/discover';

function Discover() {
  const {
    // Tab state
    activeTab,
    setActiveTab,

    // Loading states
    isLoading,
    isLoadingGames,
    isLoadingTorrents,

    // Messages
    error,
    successMessage,

    // Trending games state
    popularityTypes,
    selectedType,
    setSelectedType,
    popularGames,
    filteredGames,
    addingGame,

    // Filter state
    selectedGenres,
    selectedThemes,
    multiplayerOnly,
    showFilters,
    availableGenres,
    availableThemes,
    activeFilterCount,

    // Filter handlers
    toggleGenre,
    toggleTheme,
    clearFilters,
    handleToggleFilters,
    handleToggleMultiplayer,

    // Game handlers
    handleAddToLibrary,
    getPopularityTypeName,
    getMultiplayerBadges,

    // Torrent state
    torrents,
    torrentSearch,
    torrentSearchInput,
    setTorrentSearchInput,
    torrentMaxAge,
    setTorrentMaxAge,
    selectedTorrent,
    setSelectedTorrent,
    handleTorrentSearch,

    // Modal state
    modalGameSearch,
    setModalGameSearch,
    modalGameResults,
    selectedGame,
    setSelectedGame,
    isSearchingGames,
    isAddingToLibrary,
    handleModalGameSearch,
    handleAddTorrentToLibrary,
    handleCloseModal,
  } = useDiscoverState();

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Discover</h1>
          <p className="text-gray-400 mt-1 text-sm md:text-base">Browse popular games and trending releases</p>
        </div>
      </div>

      {/* Tabs */}
      <DiscoverTabs activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Trending Games Controls */}
      {activeTab === 'trending' && (
        <TrendingControls
          popularityTypes={popularityTypes}
          selectedType={selectedType}
          activeFilterCount={activeFilterCount}
          showFilters={showFilters}
          onToggleFilters={handleToggleFilters}
          onSelectedTypeChange={setSelectedType}
        />
      )}

      {/* Filter Panel */}
      {activeTab === 'trending' && showFilters && (
        <FilterPanel
          availableGenres={availableGenres}
          availableThemes={availableThemes}
          selectedGenres={selectedGenres}
          selectedThemes={selectedThemes}
          multiplayerOnly={multiplayerOnly}
          activeFilterCount={activeFilterCount}
          onToggleGenre={toggleGenre}
          onToggleTheme={toggleTheme}
          onToggleMultiplayer={handleToggleMultiplayer}
          onClearFilters={clearFilters}
        />
      )}

      {/* Success message */}
      {successMessage && (
        <div className="fixed top-4 right-4 bg-green-600 text-white px-4 py-2 rounded shadow-lg z-50">
          {successMessage}
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="fixed top-4 left-4 bg-red-600 text-white px-4 py-2 rounded shadow-lg z-50">
          {error}
        </div>
      )}

      {/* Trending Games Tab Content */}
      {activeTab === 'trending' && (
        <GamesGrid
          filteredGames={filteredGames}
          totalGames={popularGames.length}
          isLoading={isLoadingGames}
          popularityTypeName={getPopularityTypeName(selectedType)}
          activeFilterCount={activeFilterCount}
          addingGameId={addingGame}
          onAddToLibrary={handleAddToLibrary}
          onClearFilters={clearFilters}
          getMultiplayerBadges={getMultiplayerBadges}
        />
      )}

      {/* Top Torrents Tab Content */}
      {activeTab === 'torrents' && (
        <>
          <TorrentSearch
            searchInput={torrentSearchInput}
            currentSearch={torrentSearch}
            maxAge={torrentMaxAge}
            isLoading={isLoadingTorrents}
            onSearchInputChange={setTorrentSearchInput}
            onMaxAgeChange={setTorrentMaxAge}
            onSubmit={handleTorrentSearch}
          />
          <TorrentsMobileView
            torrents={torrents}
            maxAge={torrentMaxAge}
            isLoading={isLoadingTorrents}
            onSelectTorrent={setSelectedTorrent}
          />
          <TorrentsTable
            torrents={torrents}
            maxAge={torrentMaxAge}
            isLoading={isLoadingTorrents}
            onSelectTorrent={setSelectedTorrent}
          />
        </>
      )}

      {/* Torrent Details Modal */}
      {selectedTorrent && (
        <TorrentDetailsModal
          torrent={selectedTorrent}
          modalGameSearch={modalGameSearch}
          modalGameResults={modalGameResults}
          selectedGame={selectedGame}
          isSearchingGames={isSearchingGames}
          isAddingToLibrary={isAddingToLibrary}
          onClose={handleCloseModal}
          onGameSearchChange={setModalGameSearch}
          onGameSearch={handleModalGameSearch}
          onSelectGame={setSelectedGame}
          onAddToLibrary={handleAddTorrentToLibrary}
        />
      )}
    </div>
  );
}

export default Discover;
