for train, test in splitter.split(X, y):
    fitted = search.fit(X[train], y[train])
