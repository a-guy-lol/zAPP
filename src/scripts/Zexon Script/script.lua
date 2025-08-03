-- #########################################################
-- ##################### Blacklist Service #################
-- #########################################################
local blacklistedGames = {
    [16732694052] = "Fisch has strong anti-cheat systems", 
    [4111023553] = "Deepwoken has detection measures",
    [9938675423] = "Oaklands might detect this",
    [6403373529] = "Slap Battles has risky anti-cheat",
    [2768379856] = "3008 doesn't allow scripts",
    [13772394625] = "Bladeball might get you banned",
    [2788229376] = "Da Hood has strict protection",
    [9872472334] = "Evade might detect scripts",
    [185655149] = "Bloxburg blocks external scripts",
    [10228136016] = "Fallen Survival has protection"
}
-- #########################################################
-- ##################### Safety Checks ####################
-- #########################################################
local function log(message)
    print("[zexon] " .. message)
end

local function safeGetService(serviceName)
    local success, service = pcall(function()
        return game:GetService(serviceName)
    end)
    if not success then
        log("couldn't get " .. serviceName .. " service :(")
        return nil
    end
    return service
end

-- #########################################################
-- ##################### Initialize Services ##############
-- #########################################################
local Players = safeGetService("Players")
local RunService = safeGetService("RunService")

if not Players or not RunService then
    log("critical services missing, can't continue")
    return
end

local LocalPlayer = Players.LocalPlayer
if not LocalPlayer then
    log("couldn't find local player")
    return
end

-- #########################################################
-- ##################### Blacklist Check #################
-- #########################################################
local placeId = game.PlaceId
if blacklistedGames[placeId] then
    local message = "hey! we had to stop because " .. blacklistedGames[placeId] .. " <3"
    LocalPlayer:Kick(message)
    while true do task.wait() end
end



-- #########################################################
-- ##################### Load Dependencies #################
-- #########################################################
local Players = game:GetService("Players")
local RunService = game:GetService("RunService")
local LocalPlayer = Players.LocalPlayer
local Workspace = game:GetService("Workspace")
local HttpService = game:GetService("HttpService")
local UserInputService = game:GetService("UserInputService")
local TweenService = game:GetService("TweenService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")
-- #########################################################
-- ################# Global Variables ######################
-- #########################################################

local angle = 1
local radius = 1
local angleSpeed = 1
local points = 1
local offsetX = 0
local offsetY = 0
local offsetZ = 0
local yOffset = 0 
local blackHoleActive = false
local blackHolePoints = {}
local humanoidRootPart, Attachment1
local nodeStrength = 500
local nodeSpeed = 500
local carVolecity = 50
local carTorque = 50
local targetPlayer = LocalPlayer.Character and LocalPlayer.Character:FindFirstChild("HumanoidRootPart") or nil

-- #########################################################
-- #################### Utility Functions ##################
-- #########################################################
local HttpService = game:GetService("HttpService")
local settings = nil

local defaultSettings = {
    nodeResponse = 750,
    nodeTorque = 750,
    speed = 10,
    range = 10,
    nodes = 1,
    autosaveEnabled = true,
    autosaveNotifications = true,
    offsetX = 0,
    offsetY = 0,
    offsetZ = 0
}

local settingsFolder = "zexon"
local settingsFile = settingsFolder .. "/cyclone-config.json"

local function ensureFolder()
    if not isfolder(settingsFolder) then
        makefolder(settingsFolder)
    end
end

local function saveSettings()
    if not settings then return end
    
    local success, result = pcall(function()
        ensureFolder()
        local json = HttpService:JSONEncode(settings)
        writefile(settingsFile, json)
    end)
    
    if not success then
        log("Settings save error: " .. tostring(result))
    end
end

local function loadSettings()
    if not HttpService then
        log("HttpService not available")
        return defaultSettings
    end

    local success, result = pcall(function()
        ensureFolder()
        if isfile(settingsFile) then
            local json = readfile(settingsFile)
            local decoded = HttpService:JSONDecode(json)
            -- Merge with defaults
            for key, value in pairs(defaultSettings) do
                if decoded[key] == nil then
                    decoded[key] = value
                end
            end
            return decoded
        end
        return defaultSettings
    end)
    
    if success then
        return result
    else
        log("Settings load error: " .. tostring(result))
        return defaultSettings
    end
end
-- #########################################################
-- ###################### Core Features ####################
-- #########################################################


if not getgenv().Network then
    getgenv().Network = {
        BaseParts = {},
        Velocity = Vector3.new(14.46262424, 14.46262424, 14.46262424)
    }
    Network.RetainPart = function(part)
        if typeof(part) == "Instance" and part:IsA("BasePart") and part:IsDescendantOf(Workspace) then
            table.insert(Network.BaseParts, part)
            part.CustomPhysicalProperties = PhysicalProperties.new(0.001, 0, 0, 0, 0)
            part.CanCollide = false
        end
    end
    local function EnablePartControl()
        LocalPlayer.ReplicationFocus = Workspace
        RunService.Heartbeat:Connect(function()
            sethiddenproperty(LocalPlayer, "SimulationRadius", math.huge)
            for _, part in pairs(Network.BaseParts) do
                if part:IsDescendantOf(Workspace) then
                    part.Velocity = Network.Velocity
                end
            end
        end)
    end
    EnablePartControl()
end
local function setupPlayer()
    local character = LocalPlayer.Character or LocalPlayer.CharacterAdded:Wait()
    humanoidRootPart = character:FindFirstChild("HumanoidRootPart")
    targetPlayer = humanoidRootPart

    local Folder = Workspace:FindFirstChild("CycloneNodes")
    if not Folder then
        Folder = Instance.new("Folder", Workspace)
        Folder.Name = "CycloneNodes"
    end
    local Part = Instance.new("Part", Folder)
    local Attachment = Instance.new("Attachment", Part)
    Part.Anchored = true
    Part.CanCollide = false
    Part.Transparency = 0
    Part.Size = Vector3.new(1, 1, 1)
    return humanoidRootPart, Attachment, Folder
end
local function updateBlackHolePoints(count)
    for _, part in pairs(blackHolePoints) do
        if part.Parent then
            part.Parent:Destroy()
        end
    end
    blackHolePoints = {}
    for i = 1, count do
        local Part = Instance.new("Part", Workspace.CycloneNodes)
        local Attachment = Instance.new("Attachment", Part)
        Part.Anchored = true
        Part.CanCollide = false
        Part.Transparency = 0.5
        Part.Size = Vector3.new(1, 1, 1)
        table.insert(blackHolePoints, Attachment)
    end
end
local function ForcePart(v)
    if v:IsA("Part") and not v.Anchored and not v.Parent:FindFirstChild("Humanoid") and not v.Parent:FindFirstChild("Head") and v.Name ~= "Handle" then
        for _, x in next, v:GetChildren() do
            if x:IsA("BodyAngularVelocity") or x:IsA("BodyForce") or x:IsA("BodyGyro") or x:IsA("BodyPosition") or x:IsA("BodyThrust") or x:IsA("BodyVelocity") or x:IsA("RocketPropulsion") then
                x:Destroy()
            end
        end
        if v:FindFirstChild("Attachment") then
            v:FindFirstChild("Attachment"):Destroy()
        end
        if v:FindFirstChild("AlignPosition") then
            v:FindFirstChild("AlignPosition"):Destroy()
        end
        if v:FindFirstChild("Torque") then
            v:FindFirstChild("Torque"):Destroy()
        end
        v.CanCollide = false

        Network.RetainPart(v)
        local Torque = Instance.new("Torque", v)
        Torque.Torque = Vector3.new(nodeStrength, nodeStrength, nodeStrength)
        local AlignPosition = Instance.new("AlignPosition", v)
        local Attachment2 = Instance.new("Attachment", v)
        Torque.Attachment0 = Attachment2
        AlignPosition.MaxForce = math.huge
        AlignPosition.MaxVelocity = math.huge
        AlignPosition.Responsiveness = nodeSpeed
        AlignPosition.Attachment0 = Attachment2

        if #blackHolePoints > 0 then
            local pointIndex = math.random(1, #blackHolePoints)
            AlignPosition.Attachment1 = blackHolePoints[pointIndex]
        end
    end
end
local function toggleBlackHole()
    blackHoleActive = not blackHoleActive
    if blackHoleActive then
        for _, v in next, Workspace:GetDescendants() do
            ForcePart(v)
        end

        Workspace.DescendantAdded:Connect(function(v)
            if blackHoleActive then
                ForcePart(v)
            end
        end)
        spawn(function()
            while blackHoleActive and RunService.RenderStepped:Wait() do
                angle = angle + math.rad(angleSpeed)
                local targetCFrame = (targetPlayer and targetPlayer.CFrame) or humanoidRootPart.CFrame
        
                for i, attachment in pairs(blackHolePoints) do
                    local angleOffset = (math.pi * 2 / #blackHolePoints) * (i - 1)
                    local baseX = math.cos(angle + angleOffset) * radius
                    local baseZ = math.sin(angle + angleOffset) * radius
                    attachment.WorldCFrame = targetCFrame * CFrame.new(
                        baseX + offsetX,
                        offsetY,
                        baseZ + offsetZ
                    )
                end
            end
        end)
    else
        for _, part in pairs(Network.BaseParts) do
            if part:IsDescendantOf(Workspace) then
                part.CustomPhysicalProperties = nil
                part.CanCollide = true
                part.Velocity = Vector3.new(0, 0, 0)
                part.RotVelocity = Vector3.new(0, 0, 0)

                for _, child in pairs(part:GetChildren()) do
                    if child:IsA("Attachment") or child:IsA("AlignPosition") or child:IsA("Torque") then
                        child:Destroy()
                    end
                end
                part.Position = Vector3.new(0, -1000, 0)
            end
        end
        Network.BaseParts = {}
        for _, attachment in pairs(blackHolePoints) do
            attachment.WorldCFrame = CFrame.new(0, -1000, 0)
        end
    end
end












-- #########################################################
-- ###################### Z-Shader Properties ####################
-- #########################################################

local Lighting = game:GetService("Lighting")

local SunRays, Bloom, ColorCorrection, DepthOfField

local function ToggleShadows(enabled)
    Lighting.GlobalShadows = enabled
    if enabled then
        Lighting.Ambient = Color3.fromRGB(50, 50, 50)
        Lighting.OutdoorAmbient = Color3.fromRGB(100, 100, 100)
    else
        Lighting.Ambient = Color3.fromRGB(128, 128, 128)
        Lighting.OutdoorAmbient = Color3.fromRGB(128, 128, 128)
    end
end

local function ToggleColorCorrection(enabled)
    if enabled then
        if not ColorCorrection then
            ColorCorrection = Instance.new("ColorCorrectionEffect")
            ColorCorrection.Brightness = 0.05
            ColorCorrection.Contrast = 0.3
            ColorCorrection.Saturation = 0.5
            ColorCorrection.TintColor = Color3.fromRGB(235, 235, 235)
            ColorCorrection.Name = "RTXv2ColorCorrection"
            ColorCorrection.Parent = Lighting
        end
    else
        if ColorCorrection then
            ColorCorrection:Destroy()
            ColorCorrection = nil
        end
    end
end

local function ToggleBloom(enabled)
    if enabled then
        if not Bloom then
            Bloom = Instance.new("BloomEffect")
            Bloom.Intensity = 0.10
            Bloom.Size = 24
            Bloom.Threshold = 4
            Bloom.Name = "RTXv2Bloom"
            Bloom.Parent = Lighting
        end
    else
        if Bloom then
            Bloom:Destroy()
            Bloom = nil
        end
    end
end

local function ToggleSunRays(enabled)
    if enabled then
        if not SunRays then
            SunRays = Instance.new("SunRaysEffect")
            SunRays.Intensity = 0.2
            SunRays.Spread = 0.3
            SunRays.Name = "RTXv2SunRays"
            SunRays.Parent = Lighting
        end
    else
        if SunRays then
            SunRays:Destroy()
            SunRays = nil
        end
    end
end
local function ToggleDOF(enabled)
    if enabled then
        if not DepthOfField then
            DepthOfField = Instance.new("DepthOfFieldEffect")
            DepthOfField.FocusDistance = 75
            DepthOfField.InFocusRadius = 175
            DepthOfField.NearIntensity = 0.3
            DepthOfField.FarIntensity = 0.5
            DepthOfField.Name = "RTXv2DOF"
            DepthOfField.Parent = Lighting
        end
    else
        if DepthOfField then
            DepthOfField:Destroy()
            DepthOfField = nil
        end
    end
end














LocalPlayer.CharacterAdded:Connect(function()
    humanoidRootPart, Attachment1 = setupPlayer()
end)
humanoidRootPart, Attachment1, Folder = setupPlayer()
updateBlackHolePoints(points)
blackHoleActive = false

local randomOffsetActive = false
local originalValues = {X = offsetX, Y = offsetY, Z = offsetZ, Range = radius} -- Save original values
local randomOffsetLoop = nil

local function toggleRandomOffsetAndRange(state)
    randomOffsetActive = state
    if randomOffsetLoop then
        randomOffsetLoop:Disconnect()
        randomOffsetLoop = nil
    end

    if randomOffsetActive then
        randomOffsetLoop = RunService.Heartbeat:Connect(function()
            offsetX = math.random(-50, 50)
            offsetY = math.random(-50, 50)
            offsetZ = math.random(-50, 50)
            radius = math.random(1, 100)
        end)
    else
        offsetX = originalValues.X
        offsetY = originalValues.Y
        offsetZ = originalValues.Z
        radius = originalValues.Range
    end
end

local function updateSeats(canTouchState)
    for _, obj in ipairs(Workspace:GetDescendants()) do
        if obj:IsA("Seat") or obj:IsA("VehicleSeat") then
            obj.CanTouch = canTouchState
        end
    end
end

local function monitorNewSeats()
    -- Monitor newly added seats
    Workspace.DescendantAdded:Connect(function(obj)
        if blackHoleActive and (obj:IsA("Seat") or obj:IsA("VehicleSeat")) then
            obj.CanTouch = false
        end
    end)
end




settings = loadSettings()
local function applySettings()
    if not settings then
        settings = defaultSettings
    end
    
    nodeSpeed = settings.nodeResponse
    nodeStrength = settings.nodeTorque
    angleSpeed = settings.speed
    radius = settings.range
    points = settings.nodes
    offsetX = settings.offsetX
    offsetY = settings.offsetY
    offsetZ = settings.offsetZ
    
    updateBlackHolePoints(points)
end
applySettings()

-- #########################################################
-- ######################## UI Setup #######################
-- #########################################################
local uilibrary = loadstring(game:HttpGet("https://raw.githubusercontent.com/a-guy-lol/program-project/refs/heads/main/zexonMain/zexonUI.lua"))()
local windowz = uilibrary:CreateWindow("                                                              Zexon V1.3.2", "(Zyron)", true)




-- #########################################################
-- ######################## Info Page ######################
-- #########################################################

local infoPage = windowz:CreatePage("Info")
local infoSection = infoPage:CreateSection("Zexon - Info")

infoSection:CreateParagraph("welcome to zexon!", [[how's it going!

   Zexon is just a simple lightweight script hub that helps you gain access to many features 😄.
   
   oh btw use Z key to close and open the UI
   
   even though exploiting is fun, we decided to blacklist these games due to their anticheats:
   
   Blacklisted Games:
   - Fisch
   - Deepwoken
   - Oaklands
   - Slap Battles
   - 3008
   - Bladeball
   - Da Hood
   - Evade
   - Bloxburg
   - Fallen Survival
   
   we just want to keep you safe from these evil anti cheats 😔.
]], 22)

infoSection:CreateParagraph("Discontinue Note", [[
   Zexon Script will be discontinued forever. The only updates I will provide are loadstring fixes so the script executes and is usuable.
]], 4)


local infoSection = infoPage:CreateSection("Zexon - Latest Update")
infoSection:CreateParagraph("Zexon Release V1.3.2 - 2025 May 15", [[
   + Fixed Zexon Loadstring error once again..
]], 4)









-- #########################################################
-- ######################## Main Page ######################
-- #########################################################
local mainPage = windowz:CreatePage("Main")
local mainSection = mainPage:CreateSection("Main - FE")

mainSection:CreateButton("   Execute | Inf Yield", function ()
   loadstring(game:HttpGet('https://raw.githubusercontent.com/EdgeIY/infiniteyield/master/source'))()
end)
mainSection:CreateSlider("   Change WalkSpeed", {Min = 16, Max = 150, DefaultValue = 16}, function(Value)
        local speaker = game.Players.LocalPlayer
        local Char = speaker.Character or workspace:FindFirstChild(speaker.Name)
        local Human = Char and Char:FindFirstChildWhichIsA("Humanoid")

        if Char and Human then
            Human.WalkSpeed = Value
        end
        HumanModCons = HumanModCons or {}
        HumanModCons.wsLoop = (HumanModCons.wsLoop and HumanModCons.wsLoop:Disconnect() and false) or Human:GetPropertyChangedSignal("WalkSpeed"):Connect(function()
            if Human then
                Human.WalkSpeed = Value
            end
        end)
        HumanModCons.wsCA = (HumanModCons.wsCA and HumanModCons.wsCA:Disconnect() and false) or speaker.CharacterAdded:Connect(function(nChar)
            Char, Human = nChar, nChar:WaitForChild("Humanoid")
            Human.WalkSpeed = Value
            HumanModCons.wsLoop = (HumanModCons.wsLoop and HumanModCons.wsLoop:Disconnect() and false) or Human:GetPropertyChangedSignal("WalkSpeed"):Connect(function()
                if Human then
                    Human.WalkSpeed = Value
                end
            end)
        end)
end)




mainSection:CreateToggle("   Z-Shaders", {Toggled = false, Description = "Toggles custom shaders provided by Zexon"}, function(Value)
    if Value then
        ToggleShadows(true)
        ToggleColorCorrection(true)
        ToggleBloom(true)
        ToggleSunRays(true)
        ToggleDOF(true)
    else
        ToggleShadows(false)
        ToggleColorCorrection(false)
        ToggleBloom(false)
        ToggleSunRays(false)
        ToggleDOF(false)
    end
end)





-- #########################################################
-- ######################## Fling Players ##################
-- #########################################################
local bugFling = {
    [189707] = true,
    [606849621] = true
}
local targetDropdown, targetCharacter
local placeId = game.PlaceId
local flingSection = mainPage:CreateSection("Fling Players - FE")
local function updateTargetDropdown()
    local playerOptions = {}
    for _, player in pairs(Players:GetPlayers()) do
        if player ~= LocalPlayer then
            table.insert(playerOptions, player.Name)
        end
    end

    if targetDropdown then
        targetDropdown:Clear()
        targetDropdown:Add(playerOptions)
    end
end
targetDropdown = flingSection:CreateDropdown("Select a Target", {
    List = {},
    Default = nil
}, function(selectedPlayerName)
    local selectedPlayer = Players:FindFirstChild(selectedPlayerName)
    if selectedPlayer and selectedPlayer.Character then
        targetCharacter = selectedPlayer.Character
    else
        targetCharacter = nil
    end
end)
Players.PlayerAdded:Connect(updateTargetDropdown)
Players.PlayerRemoving:Connect(updateTargetDropdown)
updateTargetDropdown()

local function isTargetMoving(TargetRootPart)
    return TargetRootPart.Velocity.Magnitude > 0.5
end
local function randomDecimal(min, max)
    return min + math.random() * (max - min)
end
local function SkidFling(TargetPlayer)
    local Character = LocalPlayer.Character
    local Humanoid = Character and Character:FindFirstChildOfClass("Humanoid")
    local RootPart = Humanoid and Humanoid.RootPart

    local TCharacter = TargetPlayer.Character
    local THumanoid = TCharacter and TCharacter:FindFirstChildOfClass("Humanoid")
    local TRootPart = THumanoid and THumanoid.RootPart
    local THead = TCharacter and TCharacter:FindFirstChild("Head")

    if not (Character and Humanoid and RootPart) then
        return false
    end

    if not (TCharacter and THumanoid and TRootPart) then
        return false
    end
    if not getgenv().OldPos then
        getgenv().OldPos = RootPart.CFrame
    end
    local TargetStartPos = TRootPart.Position
    
    local StartTime = tick()
    local MaxFlingTime = 9.25

    local FPos = function(BasePart, Pos, Ang)
        RootPart.CFrame = CFrame.new(BasePart.Position) * Pos * Ang
        Character:SetPrimaryPartCFrame(CFrame.new(BasePart.Position) * Pos * Ang)
        RootPart.Velocity = Vector3.new(9e7, 9e7 * 10, 9e7)
        RootPart.RotVelocity = Vector3.new(9e8, 9e8, 9e8)
    end
    local SFBasePart = function(BasePart)
        local Angle = 0

        repeat
            if (TRootPart.Position - TargetStartPos).Magnitude > 100 then
                return true
            end
            if not Humanoid or Humanoid.Health <= 0 then
                return false
            end
            if tick() - StartTime > MaxFlingTime then
                uilibrary:AddNoti("Anti-fling detected", "Target has antifling", 3, true)
                return false
            end
            Angle = Angle + 0
            local moveDirection = TRootPart.Velocity.Unit
            local offset
            if isTargetMoving(TRootPart) then
                local forwardOffset = moveDirection * randomDecimal(-10, 10)
                offset = forwardOffset
            else
                offset = Vector3.new(0, 1, 0)
            end
            FPos(BasePart, CFrame.new(offset) + Vector3.new(math.random(-1, 1), 0, math.random(-1, 1)), CFrame.Angles(math.rad(Angle), 0, 0))
            task.wait()
        until BasePart.Parent ~= TargetPlayer.Character
    end
    workspace.FallenPartsDestroyHeight = math.huge
    local BV = Instance.new("BodyVelocity")
    BV.Name = "FlingVelocity"
    BV.Parent = RootPart
    BV.Velocity = Vector3.new(9e8, 9e8, 9e8)
    BV.MaxForce = Vector3.new(math.huge, math.huge, math.huge)
    local success = false
    if TRootPart then
        success = SFBasePart(TRootPart)
    elseif THead then
        success = SFBasePart(THead)
    else
        success = false
    end
    BV:Destroy()
    RootPart.Velocity = Vector3.zero
    RootPart.RotVelocity = Vector3.zero
    workspace.FallenPartsDestroyHeight = -500
    RootPart.CFrame = getgenv().OldPos
    task.wait(0.1)
    return success
end
local function FlingAll()
    local players = Players:GetPlayers()
    local totalPlayers = #players - 1
    local flungCount = 0

    for _, player in ipairs(players) do
        if player ~= LocalPlayer then
            if not LocalPlayer.Character or not LocalPlayer.Character:FindFirstChildOfClass("Humanoid") or LocalPlayer.Character:FindFirstChildOfClass("Humanoid").Health <= 0 then
                uilibrary:AddNoti("Fling All Stopped", "You died during the flinging process.", 3, true)
                break
            end
            if SkidFling(player) then
                flungCount = flungCount + 1
                uilibrary:AddNoti(
                    "Flung Player.",
                    string.format("%d/%d Players flung", flungCount, totalPlayers),
                    3,
                    true
                )
            end
        end
    end
    local Character = LocalPlayer.Character
    local Humanoid = Character and Character:FindFirstChildOfClass("Humanoid")
    local RootPart = Humanoid and Humanoid.RootPart
    if RootPart then
        RootPart.Velocity = Vector3.zero
        RootPart.RotVelocity = Vector3.zero
        RootPart.CFrame = getgenv().OldPos
    end
end
if bugFling[placeId] then
flingSection:CreateButton('   Fling Target   -    Might not work', function()
    if targetCharacter then
        local TargetPlayer = Players:FindFirstChild(targetCharacter.Name)
        if TargetPlayer then
            SkidFling(TargetPlayer)
        end
    end
end)
flingSection:CreateButton('   Fling All     -      Might not work ', function()
    FlingAll()
end)

else
flingSection:CreateButton("   Fling All", function()
    FlingAll()
end)
flingSection:CreateButton("   Fling Target", function()
    if targetCharacter then
        local TargetPlayer = Players:FindFirstChild(targetCharacter.Name)
        if TargetPlayer then
            SkidFling(TargetPlayer)
        end
    end
end)
end









-- #########################################################
-- ######################## Cyclone #######################
-- #########################################################
local CyclonePage = windowz:CreatePage("Cyclone")
local CycloneSection = CyclonePage:CreateSection("Cyclone - Settings")
CycloneSection:CreateSlider("   Speed        - Orbit speed", {Min = 1, Max = 50, DefaultValue = settings.speed}, function(Value)
    settings.speed = Value
    angleSpeed = Value
end)
CycloneSection:CreateSlider("   Range        - Distance between the player", {Min = 1, Max = 125, DefaultValue = settings.range}, function(Value)
    if not randomOffsetActive then
        settings.range = Value
        radius = Value
    end
end)
CycloneSection:CreateSlider("   Nodes        - Amount of cyclones", {Min = 1, Max = 10, DefaultValue = settings.nodes}, function(Value)
    settings.nodes = Value
    points = Value
    updateBlackHolePoints(points)
end)
local playerDropdown

local function refreshPlayerDropdown()
    local playerNames = {}
    for _, player in pairs(Players:GetPlayers()) do
        table.insert(playerNames, player.Name)
    end

    if playerDropdown then
        playerDropdown:Clear()
        playerDropdown:Add(playerNames)
    end
end

local selectedPlayerName = nil
local targetPlayer = nil

local function updateTargetPlayer()
    if selectedPlayerName then
        local player = Players:FindFirstChild(selectedPlayerName)
        if player and player.Character then
            targetPlayer = player.Character:FindFirstChild("HumanoidRootPart")
        else
            targetPlayer = nil
        end
    else
        targetPlayer = nil
    end
end

local function onPlayerRespawn(player)
    if player.Name == selectedPlayerName then
        player.CharacterAdded:Connect(function(character)
            targetPlayer = character:WaitForChild("HumanoidRootPart")
        end)
    end
end



Players.PlayerAdded:Connect(function(player)
    refreshPlayerDropdown()
    onPlayerRespawn(player)
end)

Players.PlayerRemoving:Connect(refreshPlayerDropdown)


spawn(function()
    while true do
        wait(1.5)
        if not humanoidRootPart or not humanoidRootPart:IsDescendantOf(Workspace) then
            if LocalPlayer.Character then
                wait(1.5)
                humanoidRootPart = LocalPlayer.Character:FindFirstChild("HumanoidRootPart")
                if selectedPlayerName == LocalPlayer.Name then
                    targetPlayer = humanoidRootPart
                end
            end
        end
    end
end)

CycloneSection:CreateToggle("   Enable Cyclone", {Toggled = false, Description = false}, function(Value)
    if Value then
        toggleBlackHole() -- Enable the Cyclone
        updateSeats(false) -- Disable CanTouch for all seats
        monitorNewSeats() -- Monitor for newly added seats
    else
        blackHoleActive = false -- Mark Cyclone as inactive
        updateSeats(true) -- Re-enable CanTouch for all seats
    end
end)

local CycloneAdvancedSection = CyclonePage:CreateSection("Advanced - Settings")
CycloneAdvancedSection:CreateParagraph("Warning", [[
            These are more experimental features that you can change.
                                 Be careful with what you change. 
                          (Typically Node Response is best on max.)
]], 3)

refreshPlayerDropdown()
CycloneAdvancedSection:CreateToggle("   Crazy Mode", {Toggled = false, Description = "This makes your cyclone into a storm | actually is cool with 10 nodes lol"}, function(Value)
    toggleRandomOffsetAndRange(Value)
end)
CycloneAdvancedSection:CreateButton("   Collapse Cyclone", function()
    local function resetCyclone()
        if typeof(getgenv().Network) == "table" then
            if typeof(getgenv().Network.BaseParts) == "table" then
                for _, part in pairs(getgenv().Network.BaseParts) do
                    if part and part:IsA("BasePart") then
                        pcall(function()
                            -- Drop part by resetting its properties
                            part.CustomPhysicalProperties = nil
                            part.CanCollide = true
                            part.Velocity = Vector3.zero
                            part.RotVelocity = Vector3.zero
                        end)
                    end
                end
            end
            getgenv().Network.BaseParts = {}
        end
        blackHoleActive = false
        humanoidRootPart = nil
        targetPlayer = nil

        if Workspace:FindFirstChild("CycloneNodes") then
            Workspace:FindFirstChild("CycloneNodes"):Destroy()
        end

        humanoidRootPart, Attachment1, Folder = setupPlayer()
        updateBlackHolePoints(points)
    end

    local success, err = pcall(resetCyclone)
    if not success then
        warn("[zexon] Cyclone reset error:", err)
    end
end)
CycloneAdvancedSection:CreateSlider("   Node Response        - Reaction speed of nodes", {Min = 750, Max = 1000, DefaultValue = settings.nodeResponse}, function(Value)
    settings.nodeResponse = Value
    nodeSpeed = Value
end)
CycloneAdvancedSection:CreateSlider("   Node Torque              - Strength speed of nodes", {Min = 750, Max = 1000, DefaultValue = settings.nodeTorque}, function(Value)
    settings.nodeTorque = Value
    nodeStrength = Value
end)

CycloneAdvancedSection:CreateSlider("   X Offset", {Min = -50, Max = 50, DefaultValue = 0}, function(Value)
    offsetX = Value
end)

CycloneAdvancedSection:CreateSlider("   Y Offset", {Min = -50, Max = 50, DefaultValue = 0}, function(Value)
    offsetY = Value
    yOffset = Value
end)

CycloneAdvancedSection:CreateSlider("   Z Offset", {Min = -50, Max = 50, DefaultValue = 0}, function(Value)
    offsetZ = Value
end)















-- #########################################################
-- ################# Custom Game Logic #####################
-- #########################################################
if placeId == 189707 then 
    local customGame = windowz:CreatePage("Game")
local customGameSection = customGame:CreateSection("Natural Disaster Survival")

customGameSection:CreateButton("   Teleport | Lobby", function ()
local player = game.Players.LocalPlayer
local character = player.Character or player.CharacterAdded:Wait()
local humanoidRootPart = character:FindFirstChild("HumanoidRootPart")
if humanoidRootPart then
    humanoidRootPart.CFrame = CFrame.new(-280, 179, 341)
end
end)
customGameSection:CreateButton("   Teleport | Map", function ()
local player = game.Players.LocalPlayer
local character = player.Character or player.CharacterAdded:Wait()
local humanoidRootPart = character:FindFirstChild("HumanoidRootPart")
if humanoidRootPart then
    humanoidRootPart.CFrame = CFrame.new(-117, 48, 7)
end
end)
elseif placeId == 142823291 then
function mm2Special()
    local customGame = windowz:CreatePage("Game")
    local customGameSection = customGame:CreateSection("Murder Mystery 2")
        local function killAllMurder()
        local function findMurderer()
            return LocalPlayer
        end
        if findMurderer() ~= LocalPlayer then
            uilibrary:AddNoti("Murder Error", "You aren't the murder.", 3, true)
            return
        end
    
        if not LocalPlayer.Character:FindFirstChild("Knife") then
            local hum = LocalPlayer.Character:FindFirstChild("Humanoid")
            if LocalPlayer.Backpack:FindFirstChild("Knife") then
                hum:EquipTool(LocalPlayer.Backpack:FindFirstChild("Knife"))
            else
                uilibrary:AddNoti("Murder Error", "No knife has been detected.", 3, true)
                return
            end
        end
    
        for _, player in ipairs(game.Players:GetPlayers()) do
            if player.Character and player.Character:FindFirstChild("HumanoidRootPart") and player ~= LocalPlayer then
                player.Character:FindFirstChild("HumanoidRootPart").Anchored = true
                player.Character:FindFirstChild("HumanoidRootPart").CFrame =
                    LocalPlayer.Character:FindFirstChild("HumanoidRootPart").CFrame +
                    LocalPlayer.Character:FindFirstChild("HumanoidRootPart").CFrame.LookVector * 1
            end
        end
    
        local args = {
            [1] = "Slash"
        }
    
        -- Trigger the stab action
        LocalPlayer.Character.Knife.Stab:FireServer(unpack(args))
        end
        customGameSection:CreateButton("   Murder | Kill All | Keybind: Q", function()
    killAllMurder()
    end)
    
    local function shootMurderer()
            local LocalPlayer = game:GetService("Players").LocalPlayer
    
            local function findMurderer()
                for _, i in ipairs(game.Players:GetPlayers()) do
                    if i.Backpack:FindFirstChild("Knife") then
                        return i
                    end
                end
    
                for _, i in ipairs(game.Players:GetPlayers()) do
                    if not i.Character then continue end
                    if i.Character:FindFirstChild("Knife") then
                        return i
                    end
                end
                return nil
            end
    
            local function findSheriff()
                for _, i in ipairs(game.Players:GetPlayers()) do
                    if i.Backpack:FindFirstChild("Gun") then
                        return i
                    end
                end
    
                for _, i in ipairs(game.Players:GetPlayers()) do
                    if not i.Character then continue end
                    if i.Character:FindFirstChild("Gun") then
                        return i
                    end
                end
                return nil
            end
    
            local function getPredictedPosition(target, shootOffset)
                local targetHRP = target.Character:FindFirstChild("HumanoidRootPart")
                local targetHum = target.Character:FindFirstChild("Humanoid")
                if not targetHRP or not targetHum then
                    uilibrary:AddNoti("Sheriff Error", "Could not find required parts of the target.", 3, true)
                    return Vector3.new(0, 0, 0)
                end
    
                local targetVelocity = targetHRP.AssemblyLinearVelocity
                local predictedPosition = targetHRP.Position + (targetVelocity * Vector3.new(0, 0.5, 0)) * (shootOffset / 15)
                return predictedPosition
            end
    
            if findSheriff() ~= LocalPlayer then
                uilibrary:AddNoti("Sheriff Error", "No gun detected.", 3, true)
                return
            end
    
            local murderer = findMurderer()
            if not murderer then
                uilibrary:AddNoti("Sheriff Error", "Murder has died or left.", 3, true)
                return
            end
    
            if not LocalPlayer.Character:FindFirstChild("Gun") then
                local hum = LocalPlayer.Character:FindFirstChild("Humanoid")
                if LocalPlayer.Backpack:FindFirstChild("Gun") then
                    hum:EquipTool(LocalPlayer.Backpack:FindFirstChild("Gun"))
                else
                    uilibrary:AddNoti("Murder Error", "You don't have the gun.", 3, true)
                    return
                end
            end
    
            local murdererHRP = murderer.Character:FindFirstChild("HumanoidRootPart")
            if not murdererHRP then
                uilibrary:AddNoti("Murder Error", "Could not find the murderer's HumanoidRootPart.", 3, true)
                return
            end
    
            local shootOffset = 2.8 -- Adjust if needed
            local predictedPosition = getPredictedPosition(murderer, shootOffset)
    
            local args = {
                [1] = 1,
                [2] = predictedPosition,
                [3] = "AH2"
            }
    
            LocalPlayer.Character.Gun.KnifeLocal.CreateBeam.RemoteFunction:InvokeServer(unpack(args))
        end
        
    function shootMurderButton()
        local function shootMurderer()
        local LocalPlayer = game:GetService("Players").LocalPlayer
    
        local function findMurderer()
            for _, i in ipairs(game.Players:GetPlayers()) do
                if i.Backpack:FindFirstChild("Knife") then
                    return i
                end
            end
    
            for _, i in ipairs(game.Players:GetPlayers()) do
                if not i.Character then continue end
                if i.Character:FindFirstChild("Knife") then
                    return i
                end
            end
            return nil
        end
    
        local function findSheriff()
            for _, i in ipairs(game.Players:GetPlayers()) do
                if i.Backpack:FindFirstChild("Gun") then
                    return i
                end
            end
    
            for _, i in ipairs(game.Players:GetPlayers()) do
                if not i.Character then continue end
                if i.Character:FindFirstChild("Gun") then
                    return i
                end
            end
            return nil
        end
    
        local function getPredictedPosition(target, shootOffset)
            local targetHRP = target.Character:FindFirstChild("HumanoidRootPart")
            local targetHum = target.Character:FindFirstChild("Humanoid")
            if not targetHRP or not targetHum then return Vector3.new(0, 0, 0), "Missing parts" end
    
            local targetVelocity = targetHRP.AssemblyLinearVelocity
            local predictedPosition = targetHRP.Position + (targetVelocity * Vector3.new(0, 0.5, 0)) * (shootOffset / 15)
            return predictedPosition
        end
    
        if findSheriff() ~= LocalPlayer then
            warn("You're not the sheriff/hero.")
            return
        end
    
        local murderer = findMurderer()
        if not murderer then
            warn("No murderer found.")
            return
        end
    
        if not LocalPlayer.Character:FindFirstChild("Gun") then
            local hum = LocalPlayer.Character:FindFirstChild("Humanoid")
            if LocalPlayer.Backpack:FindFirstChild("Gun") then
                hum:EquipTool(LocalPlayer.Backpack:FindFirstChild("Gun"))
            else
                warn("You don't have the gun.")
                return
            end
        end
    
        local murdererHRP = murderer.Character:FindFirstChild("HumanoidRootPart")
        if not murdererHRP then
            
            return
        end
    
        local shootOffset = 2.8 -- Adjust if needed
        local predictedPosition = getPredictedPosition(murderer, shootOffset)
    
        local args = {
            [1] = 1,
            [2] = predictedPosition,
            [3] = "AH2"
        }
    
        LocalPlayer.Character.Gun.KnifeLocal.CreateBeam.RemoteFunction:InvokeServer(unpack(args))
    end
    
    -- Call the function to execute
    shootMurderer()
    end
    customGameSection:CreateButton("   Sheriff | Shoot Murder | Keybind: E", function()
        shootMurderer()
    end)
    
    local sheriffKey = "e"
    local murderKey = "q"
    UserInputService.InputBegan:Connect(function(input, gameProcessed)
    
        local keyPressed = input.KeyCode.Name:lower()
    
        if keyPressed == sheriffKey then
            -- Call the function for the sheriff keybind
            shootMurderer()
        elseif keyPressed == murderKey then
            -- Call the function for the murder keybind
            -- Replace shootMurderer() with the relevant function for murderKey
            killAllMurder()
        end
    end)
    
    local roles = {}
    local globalMurderer = nil
    local globalSheriff = nil
    local espConnection = nil -- To store the RenderStepped connection
    
    -- > Functions < --
    
    -- Function to check if a player is alive
    local function IsAlive(Player)
        for i, v in pairs(roles) do
            if Player.Name == i then
                return not v.Killed and not v.Dead
            end
        end
        return false
    end
    
    -- Function to create highlights for players
    local function CreateHighlights()
        for _, player in pairs(Players:GetChildren()) do
            if player ~= LocalPlayer and player.Character and not player.Character:FindFirstChild("Highlight") then
                local highlight = Instance.new("Highlight", player.Character)
                highlight.FillTransparency = 0.5
                highlight.OutlineTransparency = 0.5
            end
        end
    end
    
    -- Function to update highlights based on player roles
    local function UpdateHighlights()
        for _, player in pairs(Players:GetChildren()) do
            if player ~= LocalPlayer and player.Character and player.Character:FindFirstChild("Highlight") then
                local highlight = player.Character:FindFirstChild("Highlight")
                if player.Name == globalSheriff and IsAlive(player) then
                    highlight.FillColor = Color3.fromRGB(0, 0, 255) -- Blue for Sheriff
                elseif player.Name == globalMurderer and IsAlive(player) then
                    highlight.FillColor = Color3.fromRGB(255, 0, 0) -- Red for Murderer
                else
                    highlight.FillColor = Color3.fromRGB(0, 255, 0) -- Green for Innocent
                end
            end
        end
    end
    
    local function RemoveHighlights()
        for _, player in pairs(Players:GetChildren()) do
            if player.Character and player.Character:FindFirstChild("Highlight") then
                player.Character:FindFirstChild("Highlight"):Destroy()
            end
        end
    end
    
    -- Function to retrieve player roles
    local function UpdateRoles()
        local success, result = pcall(function()
            return ReplicatedStorage:FindFirstChild("GetPlayerData", true):InvokeServer()
        end)
    
        if success and result then
            roles = result
            for playerName, roleData in pairs(roles) do
                if roleData.Role == "Murderer" then
                    globalMurderer = playerName
                elseif roleData.Role == "Sheriff" then
                    globalSheriff = playerName
                end
            end
        else
        end
    end

    customGameSection:CreateToggle("   Roles ESP", {Toggled = false, Description = "Toggle Roles ESP On/Off"}, function(Toggled)
        if Toggled then
            -- Enable Roles ESP
            espConnection = RunService.RenderStepped:Connect(function()
                UpdateRoles()
                CreateHighlights()
                UpdateHighlights()
            end)
        else
            -- Disable Roles ESP and cleanup
            if espConnection then
                espConnection:Disconnect()
                espConnection = nil
            end
            RemoveHighlights()
        end
    end)
    end
    mm2Special()
    else
        local customGame = windowz:CreatePage("Game")
        local customGameSection = customGame:CreateSection("Unknown Game")
        customGameSection:CreateParagraph("Unsupported Game", [[
       This custom game is unsupported. Custom games that we put here have their own exploits to teleport to locations or to do an automation.
       We currently only support:
       - Natural Disaster Survival
       - Murder Mystery 2
       
       More custom games will be added.
    ]], 7)
    end












    


-- #########################################################
-- #################### Settings Logic #####################
-- #########################################################
local settingsPage = windowz:CreatePage("Settings")
local settingsSection = settingsPage:CreateSection("Zexon - Settings")

function loadGetServiceV95()
    local serviceV96 = windowz:CreatePage("ServiceTab - FE")
    local serviceSectionV98 = serviceV96:CreateSection("Service - Settings")
    serviceSectionV98:CreateButton("   Unpack | ServiceV6", function ()
    loadstring(game:HttpGet('https://pastebin.com/raw/c3b0rWf1'))()
    end)
    serviceSectionV98:CreateButton("   Unpack | ServiceV15", function ()
    loadstring(game:HttpGet('https://pastebin.com/raw/2Xk8Tm8r'))()
    end)
end
if getgenv().syLaBgQEIxLMqjOuVhNop3AUXlcDG3 == "3mgSJ9XjIBEmIsFmAdrukvtLWnMQoc6z" then
    loadGetServiceV95()
end
settingsSection:CreateToggle("   Autosave Notifications", {Toggled = settings.autosaveNotifications, Description = "Toggle autosave notifications on/off"}, function(Value)
    settings.autosaveNotifications = Value
    autosaveNotifications = Value
    saveSettings()

end)

settingsSection:CreateToggle("   Enable Autosave", {Toggled = settings.autosaveEnabled, Description = "Enable or disable autosaving configurations"}, function(Value)
    settings.autosaveEnabled = Value 
    saveSettings()
end)

local settingsTerminateSection = settingsPage:CreateSection("Zexon - Terminate")
settingsTerminateSection:CreateButton("Terminate | Zexon Script", function()
    local function safeCleanup()
        local coreGui = game:GetService("CoreGui")
        if coreGui:FindFirstChild("ZexonUI") then
            coreGui:FindFirstChild("ZexonUI"):Destroy()
        end
        ToggleShadows(false)
        ToggleColorCorrection(false)
        ToggleBloom(false)
        ToggleSunRays(false)
        ToggleDOF(false)
    end
    safeCleanup()
    print("[zexon] script has been terminated.")
end)

spawn(function()
    while true do
        task.wait(15)
        if settings.autosaveEnabled then
            saveSettings()
            if autosaveNotifications then
                uilibrary:AddNoti("Settings Autosaved.", "Zexon has successfully autosaved your settings.", 5, true)
            end
        end
        
    end
end)
spawn(function()
    task.wait(1)
    uilibrary:AddNoti("UI loaded.", "Zexon has successfully loaded your settings.", 5, true)
end)







-- #########################################################
-- ###################### Release Notes ####################
-- #########################################################

local releasePage = windowz:CreatePage("Releases")

local releasesSection = releasePage:CreateSection("Zexon - Releases")
releasesSection:CreateParagraph("Devlogs", [[
   hey there. 
   Zexon consists of 2 developers. 
   The identities of the developers will be kept private.
   
   
   ~ Happy to say we fixed playerlist bugs.
   ~ We kinda tweaked some tabs and the releases page but eh minor change no need to list.
   ~ We're also looking to add a universal car speed changer if possible and other much unique features.
   
]], 10)

-- #########################################################
-- ###################### Releases ####################
-- #########################################################

-- Latest Release:

local releaseV131 = releasePage:CreateSection("Zexon (Zyron) | Release V1.3.2 - 2025 May 15")
releaseV131:CreateParagraph("Another Zexon Fix", [[
   + Fixed Zexon Loadstring error once again..
]], 2)

local releaseV131 = releasePage:CreateSection("Zexon (Zyron) | Release V1.3.1 - 2024 Dec 21")
releaseV131:CreateParagraph("Zexon Fix", [[
   + Fixed Zexon Loadstring error
]], 2)

local releaseV130 = releasePage:CreateSection("Zexon (Zyron) | Release V1.3 - 2024 Dec 14")
releaseV130:CreateParagraph("New features and fixes", [[
   + Added "Fallen Survival" to the blacklist.
   + Fixed ZexonUI's errors (sometimes pages wouldn't load) 
   + Zexon Cyclone Updates
        - Added collapse button to drop Cyclone Parts
        - New seats noclip for Cyclone to reduce getting flung
        - New X,Y,Z configs
        - Added Crazy Mode toggle for fun
        - Updated player dropdown and FINALLY FIXED THIS..
   + Adjusted fling logic for better consistency.
   Note: Cyclone will be disregarded for some time due to lack of development time. This update took quite a bit cause I wanted to fix all of the current ongoing issuses. It involved a lot of testing but I concluded it and the script is more stable.
]], 14)


local releaseV124 = releasePage:CreateSection("Zexon (Zuvok) | Release V1.2.4 - 2024 Dec 7")
releaseV124:CreateParagraph("Config Updates", [[
   + Seperated Cyclone for ease of use.
   + Cyclone now saves configs automatically.
   + New Fling feature for players. (Better fling logic for moving targets.)
   + Anti-cheat safeguard added for safety. (I mean do you really want to get banned? we're protecting you.)
   + New Releases, Custom Game, and Settings tabs!.
   Note: Fixing Cyclone Playerlist dropdown bug soon. 🧐
]], 7)

local releaseV123 = releasePage:CreateSection("Zexon (Zuvok) | Release V1.2.3 - 2024 Dec 4")
releaseV123:CreateParagraph("Bug Fixes and Features", [[
   + Notifications added for better user feedback. 😎
   + Reintroduced Playerlist targeting dropdown for Cyclone.
   + Improved Cyclone toggle logic and respawn handling (trust me i broke it ☹️)
   + Dropdowns now refresh reliably when players join or leave.
]], 3)

local releaseV122 = releasePage:CreateSection("Zexon (Zuvok) | Release V1.2.2 - 2024 Dec 2")
releaseV122:CreateParagraph("UI Hotfix", [[
   + 'Z' keybind added to a toggle to show/hide Zexon (Zuvok).
   - Removed Playerlist targeting due to bugs
   + Tuned some Cyclone node settings.
   Note: no mobile support. 😥
]], 4)

local releaseV121 = releasePage:CreateSection("Zexon (Zuvok) | Release V1.2.1 - 2024 Dec 1")
releaseV121:CreateParagraph("Execution Fix", [[
   + Resolved critical execution issues for a smoother start-up.
   + Optimized UI execution for better performance.
]], 3)

local releaseV120 = releasePage:CreateSection("Zexon (Zuvok) | Release V1.2 - 2024 Nov 30")
releaseV120:CreateParagraph("Cyclone Improvements", [[
   + Playerlist targeting added for Cyclone.
   + Advanced Cyclone settings:
       - Node Response and Torque sliders
   + Fixed Cyclone node stability issues.️
   + Smooth orbit and dynamic node management.
   + UI tweaks for better readability. 🎨
   + performance optimizations.
]], 7)

local releaseV110 = releasePage:CreateSection("Zexon (Zeya) | Release V1.1 - 2024 Nov 27")
releaseV110:CreateParagraph("UI and Stability", [[
   + Switched to ZexonUI (Zeya) - lightweight and responsive UI. 🤩
   + Cyclone Settings added:
       - Range, Speed, and Node adjustments.
       - Toggle to enable or disable Cyclone. 🌪️
   + Cyclone now stable after player respawn. 💪
   + Added Infinite Yield executor for quick commands. 🚀
   Note: Cyclone updates and optimizations in progress.
]], 7)


local releaseV101 = releasePage:CreateSection("Zexon (Sirius) | Release V1.0.1 - 2024 Nov 26")
releaseV101:CreateParagraph("New Rayfield Theme", [[
   + Cool new Rayfield theme added! 😎
   + Removed some UI buttons that were pretty useless.
]], 3)

local releaseV1 = releasePage:CreateSection("Zexon Release V1 - 2024 Nov 21")
releaseV1:CreateParagraph("Zexon Release", [[
   + Switched over to Sirius (RayField)
   + Added WalkSpeed slider feature.
   + Infinite Yield button added.
   + Cyclone - FE introduced!
   Note: The Release of this script. How amusing! 🥳
]], 5)
-- #########################################################
-- ##################### Load Main Script ################
-- #########################################################

log("[zexon] all done! script is executed <3")