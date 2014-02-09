var syncthing = angular.module('syncthing', []);

syncthing.controller('SyncthingCtrl', function ($scope, $http) {
    var prevDate = 0;
    var modelGetOK = true;

    $scope.connections = {};
    $scope.config = {};
    $scope.myID = "";
    $scope.nodes = [];

    // Strings before bools look better
    $scope.settings = [
        {id: 'ListenStr', descr:"Sync Protocol Listen Addresses", type: 'string', restart: true},
        {id: 'GUIAddress', descr: "GUI Listen Address", type: 'string', restart: true},
        {id: 'MaxSendKbps', descr: "Outgoing Rate Limit (KBps)", type: 'string', restart: true},
        {id: 'RescanIntervalS', descr: "Rescan Interval (s)", type: 'string', restart: true},
        {id: 'ReconnectIntervalS', descr: "Reconnect Interval (s)", type: 'string', restart: true},
        {id: 'ParallelRequests', descr: "Max Outstanding Requests", type: 'string', restart: true},
        {id: 'MaxChangeKbps', descr: "Max File Change Rate (KBps)", type: 'string', restart: true},

        {id: 'ReadOnly', descr: "Read Only", type: 'bool', restart: true},
        {id: 'AllowDelete', descr: "Allow Delete", type: 'bool', restart: true},
        {id: 'FollowSymlinks', descr: "Follow Symlinks", type: 'bool', restart: true},
        {id: 'GlobalAnnEnabled', descr: "Global Announce", type: 'bool', restart: true},
        {id: 'LocalAnnEnabled', descr: "Local Announce", type: 'bool', restart: true},
    ];

    function modelGetSucceeded() {
        if (!modelGetOK) {
            $('#networkError').modal('hide');
            modelGetOK = true;
        }
    }

    function modelGetFailed() {
        if (modelGetOK) {
            $('#networkError').modal({backdrop: 'static', keyboard: false});
            modelGetOK = false;
        }
    }

    $http.get("/rest/version").success(function (data) {
        $scope.version = data;
    });
    $http.get("/rest/system").success(function (data) {
        $scope.system = data;
        $scope.myID = data.myID;

        $http.get("/rest/config").success(function (data) {
            $scope.config = data;
            $scope.config.Options.ListenStr = $scope.config.Options.ListenAddress.join(", ")

            var nodes = $scope.config.Repositories[0].Nodes;
            nodes = nodes.filter(function (x) { return x.NodeID != $scope.myID; });
            nodes.sort(function (a, b) {
                if (a.NodeID < b.NodeID)
                    return -1;
                return a.NodeID > b.NodeID;
            })
            $scope.nodes = nodes;
        });
    });

    $scope.refresh = function () {
        $http.get("/rest/system").success(function (data) {
            $scope.system = data;
        });
        $http.get("/rest/model").success(function (data) {
            $scope.model = data;
            modelGetSucceeded();
        }).error(function () {
            modelGetFailed();
        });
        $http.get("/rest/connections").success(function (data) {
            var now = Date.now();
            var td = (now - prevDate) / 1000;
            prevDate = now;

            $scope.inbps = 0
            $scope.outbps = 0
            for (var id in data) {
                try {
                    data[id].inbps = Math.max(0, 8 * (data[id].InBytesTotal - $scope.connections[id].InBytesTotal) / td);
                    data[id].outbps = Math.max(0, 8 * (data[id].OutBytesTotal - $scope.connections[id].OutBytesTotal) / td);
                } catch (e) {
                    data[id].inbps = 0;
                    data[id].outbps = 0;
                }
                $scope.inbps += data[id].outbps;
                $scope.outbps += data[id].inbps;
            }
            $scope.connections = data;
        });
        $http.get("/rest/need").success(function (data) {
            var i, name;
            for (i = 0; i < data.length; i++) {
                name = data[i].Name.split("/");
                data[i].ShortName = name[name.length-1];
            }
            data.sort(function (a, b) {
                if (a.ShortName < b.ShortName) {
                    return -1;
                }
                if (a.ShortName > b.ShortName) {
                    return 1;
                }
                return 0;
            });
            $scope.need = data;
        });
    };

    $scope.nodeIcon = function (nodeCfg) {
        if ($scope.connections[nodeCfg.NodeID]) {
            return "ok";
        }

        return "minus";
    };

    $scope.nodeStatus = function (nodeCfg) {
        if ($scope.connections[nodeCfg.NodeID]) {
            return "Connected";
        }

        return "Disconnected";
    };

    $scope.nodeIcon = function (nodeCfg) {
        if ($scope.connections[nodeCfg.NodeID]) {
            return "ok";
        }

        return "minus";
    };

    $scope.nodeClass = function (nodeCfg) {
        var conn = $scope.connections[nodeCfg.NodeID];
        if (conn) {
            return "success";
        }

        return "info";
    };

    $scope.nodeAddr = function (nodeCfg) {
        var conn = $scope.connections[nodeCfg.NodeID];
        if (conn) {
            return conn.Address;
        }
        return nodeCfg.Addresses.join(", ");
    };

    $scope.nodeVer = function (nodeCfg) {
        if (nodeCfg.NodeID === $scope.myID) {
            return $scope.version;
        }
        var conn = $scope.connections[nodeCfg.NodeID];
        if (conn) {
            return conn.ClientVersion;
        }
        return "";
    };

    $scope.nodeName = function (nodeCfg) {
        if (nodeCfg.Name) {
            return nodeCfg.Name;
        }
        return nodeCfg.NodeID.substr(0, 6);
    };

    $scope.saveSettings = function () {
        $scope.config.Options.ListenAddress = $scope.config.Options.ListenStr.split(',').map(function (x) { return x.trim(); });
        $http.post('/rest/config', JSON.stringify($scope.config), {headers: {'Content-Type': 'application/json'}});
        $('#settingsTable').collapse('hide');
    };

    $scope.editNode = function (nodeCfg) {
        $scope.currentNode = nodeCfg;
        $scope.editingExisting = true;
        $scope.currentNode.AddressesStr = nodeCfg.Addresses.join(", ")
        $('#editNode').modal({backdrop: 'static', keyboard: false});
    };

    $scope.addNode = function () {
        $scope.currentNode = {NodeID: "", AddressesStr: "dynamic"};
        $scope.editingExisting = false;
        $('#editNode').modal({backdrop: 'static', keyboard: false});
    };

    $scope.deleteNode = function () {
        $('#editNode').modal('hide');
        if (!$scope.editingExisting)
            return;

        var newNodes = [];
        for (var i = 0; i < $scope.nodes.length; i++) {
            if ($scope.nodes[i].NodeID !== $scope.currentNode.NodeID) {
                newNodes.push($scope.nodes[i]);
            }
        } 

        $scope.nodes = newNodes;
        $scope.config.Repositories[0].Nodes = newNodes;

        $http.post('/rest/config', JSON.stringify($scope.config), {headers: {'Content-Type': 'application/json'}})
    }

    $scope.saveNode = function () {
        $('#editNode').modal('hide');
        nodeCfg = $scope.currentNode;
        nodeCfg.Addresses = nodeCfg.AddressesStr.split(',').map(function (x) { return x.trim(); });

        var done = false;
        for (var i = 0; i < $scope.nodes.length; i++) {
            if ($scope.nodes[i].NodeID === nodeCfg.NodeID) {
                $scope.nodes[i] = nodeCfg;
                done = true;
                break;
            }
        } 

        if (!done) {
            $scope.nodes.push(nodeCfg);
        }

        $scope.nodes.sort(function (a, b) {
            if (a.NodeID < b.NodeID)
                return -1;
            return a.NodeID > b.NodeID;
        })

        $scope.config.Repositories[0].Nodes = $scope.nodes;

        $http.post('/rest/config', JSON.stringify($scope.config), {headers: {'Content-Type': 'application/json'}})
    };

    $scope.refresh();
    setInterval($scope.refresh, 10000);
});

function decimals(val, num) {
    if (val === 0) { return 0; }
    var digits = Math.floor(Math.log(Math.abs(val))/Math.log(10));
    var decimals = Math.max(0, num - digits);
    return decimals;
}

syncthing.filter('natural', function() {
    return function(input, valid) {
        return input.toFixed(decimals(input, valid));
    }
});

syncthing.filter('binary', function() {
    return function(input) {
        if (input === undefined) {
            return '0 '
        }
        if (input > 1024 * 1024 * 1024) {
            input /= 1024 * 1024 * 1024;
            return input.toFixed(decimals(input, 2)) + ' Gi';
        }
        if (input > 1024 * 1024) {
            input /= 1024 * 1024;
            return input.toFixed(decimals(input, 2)) + ' Mi';
        }
        if (input > 1024) {
            input /= 1024;
            return input.toFixed(decimals(input, 2)) + ' Ki';
        }
        return Math.round(input) + ' ';
    }
});

syncthing.filter('metric', function() {
    return function(input) {
        if (input === undefined) {
            return '0 '
        }
        if (input > 1000 * 1000 * 1000) {
            input /= 1000 * 1000 * 1000;
            return input.toFixed(decimals(input, 2)) + ' G';
        }
        if (input > 1000 * 1000) {
            input /= 1000 * 1000;
            return input.toFixed(decimals(input, 2)) + ' M';
        }
        if (input > 1000) {
            input /= 1000;
            return input.toFixed(decimals(input, 2)) + ' k';
        }
        return Math.round(input) + ' ';
    }
});

syncthing.filter('short', function() {
    return function(input) {
        return input.substr(0, 6);
    }
});

syncthing.filter('alwaysNumber', function() {
    return function(input) {
        if (input === undefined) {
            return 0;
        }
        return input;
    }
});

syncthing.directive('optionEditor', function() {
    return {
        restrict: 'C',
        replace: true,
        transclude: true,
        scope: {
            setting: '=setting',
        },
        template: '<input type="text" ng-model="config.Options[setting.id]"></input>',
    };
})